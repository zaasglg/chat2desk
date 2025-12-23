<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Client;
use App\Models\Channel;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $channels = Channel::where('type', 'telegram')->where('is_active', true)->get();
        $tags = Tag::orderBy('name')->get();
        $operators = User::whereIn('role', ['admin', 'operator'])->orderBy('name')->get();
        
        $countResult = null;
        if ($request->has('count_result')) {
            $countResult = $request->get('count_result');
        }

        return Inertia::render('analytics/index', [
            'channels' => $channels,
            'tags' => $tags,
            'operators' => $operators,
            'countResult' => $countResult,
        ]);
    }

    public function calculate(Request $request)
    {
        $query = $this->buildFilterQuery($request);
        
        // Count total clients
        $totalClients = Client::count();
        
        // Count matched clients
        $matchedClients = $query->count();
        
        // Get matched client IDs for tag statistics
        $matchedClientIds = $query->pluck('id');
        
        // Calculate tag statistics for matched clients
        $tagStats = [];
        if ($matchedClientIds->isNotEmpty()) {
            $tagStats = DB::table('client_tag')
                ->join('tags', 'client_tag.tag_id', '=', 'tags.id')
                ->whereIn('client_tag.client_id', $matchedClientIds)
                ->select('tags.id', 'tags.name', 'tags.color', DB::raw('COUNT(DISTINCT client_tag.client_id) as clients_count'))
                ->groupBy('tags.id', 'tags.name', 'tags.color')
                ->orderByDesc('clients_count')
                ->get()
                ->map(function($tag) {
                    return [
                        'id' => $tag->id,
                        'name' => $tag->name,
                        'color' => $tag->color,
                        'clients_count' => $tag->clients_count,
                    ];
                });
        }
        
        $channels = Channel::where('type', 'telegram')->where('is_active', true)->get();
        $tags = Tag::orderBy('name')->get();
        $operators = User::whereIn('role', ['admin', 'operator'])->orderBy('name')->get();
        
        return Inertia::render('analytics/index', [
            'channels' => $channels,
            'tags' => $tags,
            'operators' => $operators,
            'countResult' => [
                'total' => $totalClients,
                'matched' => $matchedClients,
                'tagStats' => $tagStats,
            ],
        ]);
    }

    public function export(Request $request)
    {
        $query = $this->buildFilterQuery($request);
        
        // Get client IDs
        $clientIds = $query->pluck('id');
        
        // Get clients with their chats
        $clients = Client::whereIn('id', $clientIds)
            ->with(['chats.channel', 'tags'])
            ->get();
        
        // Generate CSV
        $filename = 'clients_export_' . date('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];
        
        $callback = function() use ($clients) {
            $file = fopen('php://output', 'w');
            
            // BOM for UTF-8
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // Headers
            fputcsv($file, ['ID', 'Имя', 'Телефон', 'Email', 'Теги', 'Каналы', 'Дата создания']);
            
            // Data
            foreach ($clients as $client) {
                $tags = $client->tags->pluck('name')->filter()->join(', ') ?: '';
                $channels = $client->chats->pluck('channel.name')->filter()->unique()->join(', ') ?: '';
                
                fputcsv($file, [
                    $client->id,
                    $client->name ?? '',
                    $client->phone ?? '',
                    $client->email ?? '',
                    $tags,
                    $channels,
                    $client->created_at ? $client->created_at->format('Y-m-d H:i:s') : '',
                ]);
            }
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }

    private function buildFilterQuery(Request $request)
    {
        $query = Client::query();
        
        // Tags - must have (client must have ALL specified tags)
        if ($request->boolean('enableTags') && $request->has('has_tag_ids') && !empty($request->has_tag_ids)) {
            $tagIds = is_array($request->has_tag_ids) ? $request->has_tag_ids : [$request->has_tag_ids];
            foreach ($tagIds as $tagId) {
                $query->whereHas('tags', function($q) use ($tagId) {
                    $q->where('tags.id', $tagId);
                });
            }
        }
        
        // Tags - must not have
        if ($request->boolean('enableNotTags') && $request->has('not_has_tag_ids') && !empty($request->not_has_tag_ids)) {
            $tagIds = is_array($request->not_has_tag_ids) ? $request->not_has_tag_ids : [$request->not_has_tag_ids];
            $query->whereDoesntHave('tags', function($q) use ($tagIds) {
                $q->whereIn('tags.id', $tagIds);
            });
        }
        
        // Client info search
        if ($request->boolean('enableClientInfo') && $request->filled('client_info_text')) {
            $field = $request->get('client_info_field', 'name');
            $text = $request->get('client_info_text');
            
            if ($field === 'id') {
                if (is_numeric($text)) {
                    $query->where('id', $text);
                } else {
                    $query->where('id', 'like', "%{$text}%");
                }
            } else {
                $query->where($field, 'like', "%{$text}%");
            }
        }
        
        // Messenger type
        if ($request->boolean('enableMessenger') && $request->filled('messenger_type')) {
            $messengerType = $request->get('messenger_type');
            $query->whereHas('chats.channel', function($q) use ($messengerType) {
                $q->where('type', $messengerType);
            });
        }
        
        // Channel
        if ($request->boolean('enableChannel') && $request->filled('channel_id')) {
            $channelId = $request->get('channel_id');
            $query->whereHas('chats', function($q) use ($channelId) {
                $q->where('channel_id', $channelId);
            });
        }
        
        // First message date range
        if ($request->boolean('enableFirstMessage')) {
            if ($request->filled('first_message_from')) {
                $fromDate = \Carbon\Carbon::parse($request->get('first_message_from'))->startOfDay();
                $query->whereHas('chats', function($q) use ($fromDate) {
                    $q->where('created_at', '>=', $fromDate);
                });
            }
            if ($request->filled('first_message_to')) {
                $toDate = \Carbon\Carbon::parse($request->get('first_message_to'))->endOfDay();
                $query->whereHas('chats', function($q) use ($toDate) {
                    $q->where('created_at', '<=', $toDate);
                });
            }
        }
        
        // Operators
        if ($request->boolean('enableOperators') && $request->has('operator_ids') && !empty($request->operator_ids)) {
            $operatorIds = is_array($request->operator_ids) ? $request->operator_ids : [$request->operator_ids];
            $query->whereHas('chats', function($q) use ($operatorIds) {
                $q->whereIn('operator_id', $operatorIds);
            });
        }
        
        // Exclude active chats
        if ($request->boolean('exclude_active_chats')) {
            $query->whereDoesntHave('chats', function($q) {
                $q->whereIn('status', ['new', 'open', 'pending']);
            });
        }
        
        // Limit quantity
        if ($request->boolean('enableLimit') && $request->filled('limit_quantity')) {
            $limit = (int) $request->get('limit_quantity');
            if ($limit > 0) {
                $query->limit($limit);
            }
        }
        
        return $query;
    }
}
