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
        $startDate = match ($period) {
            '24h' => now()->subDay(),
            '7d' => now()->subDays(7),
            '30d' => now()->subDays(30),
            '90d' => now()->subDays(90),
            default => now()->subDays(7),
        };

        // Общая статистика
        $stats = [
            'total_chats' => Chat::where('created_at', '>=', $startDate)->count(),
            'total_messages' => Message::where('created_at', '>=', $startDate)->count(),
            'incoming_messages' => Message::where('created_at', '>=', $startDate)->where('direction', 'incoming')->count(),
            'outgoing_messages' => Message::where('created_at', '>=', $startDate)->where('direction', 'outgoing')->count(),
            'resolved_chats' => Chat::where('created_at', '>=', $startDate)->where('status', 'resolved')->count(),
            'avg_response_time' => $this->calculateAvgResponseTime($startDate),
        ];

        // Статистика по каналам
        $channelStats = Channel::withCount([
            'chats' => function ($q) use ($startDate) {
                $q->where('created_at', '>=', $startDate);
            },
            'messages' => function ($q) use ($startDate) {
                $q->where('created_at', '>=', $startDate);
            },
        ])->get();

        // График сообщений по дням
        $messagesByDay = Message::where('created_at', '>=', $startDate)
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

        // Статистика по статусам
        $chatsByStatus = Chat::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return Inertia::render('analytics/index', [
            'stats' => $stats,
            'channelStats' => $channelStats,
            'messagesByDay' => $messagesByDay,
            'chatsByStatus' => $chatsByStatus,
            'period' => $period,
        ]);
    }

    private function calculateAvgResponseTime($startDate)
    {
        // Упрощенный расчет среднего времени ответа
        $chats = Chat::where('created_at', '>=', $startDate)
            ->whereNotNull('operator_id')
            ->with(['messages' => function ($q) {
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
