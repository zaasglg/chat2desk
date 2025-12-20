<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Models\Channel;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $period = $request->get('period', '7d');
        $startDateParam = $request->get('start_date');
        $endDateParam = $request->get('end_date');
        
        // Если переданы кастомные даты
        if ($startDateParam && $endDateParam) {
            $startDate = \Carbon\Carbon::parse($startDateParam)->startOfDay();
            $endDate = \Carbon\Carbon::parse($endDateParam)->endOfDay();
            $period = 'custom';
        } else {
            $endDate = now();
            $startDate = match ($period) {
                '24h' => now()->subDay(),
                '7d' => now()->subDays(7),
                '30d' => now()->subDays(30),
                '90d' => now()->subDays(90),
                default => now()->subDays(7),
            };
        }

        // Общая статистика
        $stats = [
            // Считаем чаты, у которых есть сообщения в выбранном периоде
            'total_chats' => Chat::whereHas('messages', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            })->count(),
            'total_messages' => Message::whereBetween('created_at', [$startDate, $endDate])->count(),
            'incoming_messages' => Message::whereBetween('created_at', [$startDate, $endDate])->where('direction', 'incoming')->count(),
            'outgoing_messages' => Message::whereBetween('created_at', [$startDate, $endDate])->where('direction', 'outgoing')->count(),
            // Считаем чаты, которые были решены в выбранном периоде
            'resolved_chats' => Chat::where('status', 'resolved')
                ->whereBetween('updated_at', [$startDate, $endDate])
                ->count(),
            'avg_response_time' => $this->calculateAvgResponseTime($startDate, $endDate),
        ];

        // Статистика по каналам
        $channelStats = Channel::withCount([
            'chats' => function ($q) use ($startDate, $endDate) {
                // Считаем чаты, у которых есть сообщения в выбранном периоде
                $q->whereHas('messages', function ($mq) use ($startDate, $endDate) {
                    $mq->whereBetween('created_at', [$startDate, $endDate]);
                });
            },
            'messages' => function ($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', [$startDate, $endDate]);
            },
        ])->get();

        // График сообщений по дням
        // График сообщений по дням
        $messagesByDay = Message::where('created_at', '>=', $startDate)
            ->where('created_at', '<=', $endDate)
            ->selectRaw('DATE(created_at) as date, direction, COUNT(*) as count')
            ->groupBy('date', 'direction')
            ->orderBy('date')
            ->get()
            ->groupBy('date')
            ->map(function ($items) {
                return [
                    'incoming' => $items->where('direction', 'incoming')->first()?->count ?? 0,
                    'outgoing' => $items->where('direction', 'outgoing')->first()?->count ?? 0,
                ];
            });

        // График чатов по дням (считаем уникальные чаты по сообщениям)
        $chatsByDay = Message::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE(created_at) as date, COUNT(DISTINCT chat_id) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date');

        // Статистика по статусам
        $chatsByStatus = Chat::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Статистика по тегам клиентов
        $chatsByTag = \DB::table('clien (считаем чаты с сообщениями в периоде)
        $chatsByTag = \DB::table('client_tag')
            ->join('tags', 'client_tag.tag_id', '=', 'tags.id')
            ->join('clients', 'client_tag.client_id', '=', 'clients.id')
            ->join('chats', 'chats.client_id', '=', 'clients.id')
            ->join('messages', 'messages.chat_id', '=', 'chats.id')
            ->whereBetween('messages.created_at', [$startDate, $endDate]r, COUNT(DISTINCT chats.id) as chats_count')
            ->groupBy('tags.id', 'tags.name', 'tags.color')
            ->orderByDesc('chats_count')
            ->get();

        return Inertia::render('analytics/index', [
            'stats' => $stats,
            'channelStats' => $channelStats,
            'messagesByDay' => $messagesByDay,
            'chatsByDay' => $chatsByDay,
            'chatsByStatus' => $chatsByStatus,
            'chatsByTag' => $chatsByTag,
            'period' => $period,
            'startDate' => $startDate->format('Y-m-d'),
            'endDate' => $endDate->format('Y-m-d'),
        ]);
    }

    private function calculateAvgResponseTime($startDate, $endDate = null)
    {
        // Упрощенный расчет среднего времени ответа
        $query = Chat::where('created_at', '>=', $startDate)
            ->whereNotNull('operator_id');
        
        if ($endDate) {
            $query->where('created_at', '<=', $endDate);
        }
        
        $chats = $query->with(['messages' => function ($q) {
                $q->orderBy('created_at', 'asc')->limit(2);
            }])
            ->get();

        $responseTimes = [];
        foreach ($chats as $chat) {
            $messages = $chat->messages;
            if ($messages->count() >= 2) {
                $incoming = $messages->firstWhere('direction', 'incoming');
                $outgoing = $messages->firstWhere('direction', 'outgoing');

                if ($incoming && $outgoing && $outgoing->created_at > $incoming->created_at) {
                    $responseTimes[] = $outgoing->created_at->diffInMinutes($incoming->created_at);
                }
            }
        }

        return count($responseTimes) > 0 ? round(array_sum($responseTimes) / count($responseTimes)) : 0;
    }
}
