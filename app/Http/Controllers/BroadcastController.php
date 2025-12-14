<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\ScheduledBroadcast;
use App\Models\Tag;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class BroadcastController extends Controller
{
    public function create()
    {
        return Inertia::render('broadcasts/create', [
            'channels' => \App\Models\Channel::where('is_active', true)->get()->map(function($c){
                return ['id' => $c->id, 'name' => $c->name, 'type' => $c->type];
            }),
            'tags' => Tag::orderBy('name')->get(),
            'operators' => \App\Models\User::where('role', 'operator')->orWhere('role', 'admin')->orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function count(Request $request)
    {
        $filters = $request->get('filters', []);
        $count = $this->getFilteredChatsQuery($filters)->count();
        
        return response()->json(['count' => $count]);
    }

    public function store(Request $request, TelegramService $telegramService)
    {
        $data = $request->validate([
            'content' => 'required|string',
            'attachment' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:20480',
            'filters' => 'nullable|array',
            'mass_operations' => 'nullable|array',
            'is_scheduled' => 'boolean',
            'schedule_type' => 'nullable|in:once,daily,weekly,monthly',
            'schedule_config' => 'nullable|array',
            'scheduled_at' => 'nullable|date',
            'name' => 'nullable|string|max:255',
        ]);

        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('broadcasts', 'public');
        }

        // Если это запланированная рассылка
        if ($data['is_scheduled'] ?? false) {
            $scheduled = ScheduledBroadcast::create([
                'user_id' => auth()->id(),
                'name' => $data['name'] ?? 'Рассылка ' . now()->format('d.m.Y H:i'),
                'content' => $data['content'],
                'attachment_path' => $attachmentPath,
                'filters' => $data['filters'] ?? [],
                'mass_operations' => $data['mass_operations'] ?? [],
                'is_scheduled' => true,
                'schedule_type' => $data['schedule_type'],
                'schedule_config' => $data['schedule_config'] ?? [],
                'scheduled_at' => $data['scheduled_at'] ? Carbon::parse($data['scheduled_at']) : null,
                'next_send_at' => $this->calculateNextSendAt($data['schedule_type'], $data['schedule_config'] ?? [], $data['scheduled_at']),
            ]);

            return redirect()->back()->with('success', 'Рассылка запланирована');
        }

        // Немедленная рассылка
        $chats = $this->getFilteredChatsQuery($data['filters'] ?? [])->get();
        
        // Выполнить массовые операции
        $this->executeMassOperations($chats, $data['mass_operations'] ?? []);

        // Отправить рассылку
        $sent = 0;
        $failed = 0;

        foreach ($chats as $chat) {
            // Не рассылать в открытые чаты, если указано
            if (($data['filters']['exclude_open_chats'] ?? false) && in_array($chat->status, ['new', 'open', 'pending'])) {
                continue;
            }

            $channel = $chat->channel;
            $metadata = $chat->metadata ?? [];
            $telegramChatId = $metadata['telegram_chat_id'] ?? null;

            // Заменить переменную %client на имя клиента
            $content = str_replace('%client', $chat->client->name ?? 'Клиент', $data['content']);

            $message = Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'operator_id' => null,
                'direction' => 'outgoing',
                'type' => $attachmentPath ? 'image' : 'text',
                'content' => $content,
                'status' => 'pending',
                'attachments' => $attachmentPath ? [['path' => $attachmentPath, 'name' => basename($attachmentPath)]] : null,
                'metadata' => ['sent_by' => 'broadcast'],
            ]);

            $ok = false;

            if ($channel && $channel->type === 'telegram' && $telegramChatId) {
                if ($attachmentPath) {
                    $result = $telegramService->sendPhoto($channel, $telegramChatId, Storage::disk('public')->path($attachmentPath), $content);
                } else {
                    $result = $telegramService->sendMessage($channel, $telegramChatId, $content);
                }
                
                if ($result) {
                    $ok = true;
                    $message->update([
                        'status' => 'sent',
                        'metadata' => array_merge($message->metadata ?? [], [
                            'telegram_message_id' => $result['message_id'] ?? null,
                            'sent_by' => 'broadcast'
                        ]),
                    ]);
                    $sent++;
                }
            }

            if (!$ok) {
                $failed++;
                $message->update(['status' => 'failed']);
            }
        }

        Log::info('Broadcast completed', ['sent' => $sent, 'failed' => $failed]);

        return redirect()->back()->with('success', "Рассылка отправлена: отправлено={$sent}, ошибок={$failed}");
    }

    protected function getFilteredChatsQuery(array $filters)
    {
        $query = Chat::with(['client', 'channel', 'operator'])
            ->whereNotNull('client_id');

        // Фильтр по тегам
        if (!empty($filters['tag_ids'])) {
            $query->whereHas('client.tags', function ($q) use ($filters) {
                $q->whereIn('tags.id', $filters['tag_ids']);
            });
        }

        // Фильтр по тексту в карточке клиента
        if (!empty($filters['client_text'])) {
            $searchText = $filters['client_text'];
            $query->whereHas('client', function ($q) use ($searchText) {
                $q->where('name', 'like', "%{$searchText}%")
                  ->orWhere('phone', 'like', "%{$searchText}%")
                  ->orWhere('email', 'like', "%{$searchText}%")
                  ->orWhere('notes', 'like', "%{$searchText}%");
            });
        }

        // Фильтр по мессенджеру
        if (!empty($filters['channel_type'])) {
            $query->whereHas('channel', function ($q) use ($filters) {
                $q->where('type', $filters['channel_type']);
            });
        }

        // Фильтр по каналу
        if (!empty($filters['channel_id'])) {
            $query->where('channel_id', $filters['channel_id']);
        }

        // Фильтр по первому сообщению
        if (!empty($filters['first_message_text'])) {
            $query->whereHas('messages', function ($q) use ($filters) {
                $q->where('direction', 'incoming')
                  ->whereRaw('id = (SELECT MIN(id) FROM messages WHERE chat_id = chats.id)')
                  ->where('content', 'like', "%{$filters['first_message_text']}%");
            });
        }

        // Фильтр по оператору
        if (!empty($filters['operator_id'])) {
            $query->where('operator_id', $filters['operator_id']);
        }

        // Ограничение количества
        if (!empty($filters['limit'])) {
            $query->limit((int)$filters['limit']);
        }

        return $query;
    }

    protected function executeMassOperations($chats, array $operations)
    {
        // Присвоить или удалить теги
        if (!empty($operations['tags'])) {
            $tagIds = $operations['tags']['tag_ids'] ?? [];
            $action = $operations['tags']['action'] ?? 'add'; // 'add' or 'remove'

            foreach ($chats as $chat) {
                if ($chat->client) {
                    if ($action === 'add') {
                        $chat->client->tags()->syncWithoutDetaching($tagIds);
                    } else {
                        $chat->client->tags()->detach($tagIds);
                    }
                }
            }
        }

        // Пометить чаты как прочитанные
        if ($operations['mark_read'] ?? false) {
            foreach ($chats as $chat) {
                $chat->messages()
                    ->where('direction', 'incoming')
                    ->whereNull('read_at')
                    ->update(['read_at' => now(), 'status' => 'read']);
                $chat->update(['unread_count' => 0]);
            }
        }

        // Перевести на оператора
        if (!empty($operations['assign_operator_id'])) {
            foreach ($chats as $chat) {
                $chat->update([
                    'operator_id' => $operations['assign_operator_id'],
                    'status' => 'open',
                ]);
            }
        }

        // Закрыть чаты
        if ($operations['close_chats'] ?? false) {
            $automationService = app(\App\Services\AutomationService::class);
            foreach ($chats as $chat) {
                $wasClosed = $chat->status === 'closed';
                $chat->update(['status' => 'closed']);
                
                // Trigger chat_closed automation if status changed to closed
                if (!$wasClosed) {
                    $automationService->triggerChatClosed($chat);
                }
            }
        }
    }

    protected function calculateNextSendAt(?string $scheduleType, array $config, ?string $scheduledAt): ?Carbon
    {
        if (!$scheduleType) {
            return $scheduledAt ? Carbon::parse($scheduledAt) : null;
        }

        $now = Carbon::now();
        $time = $config['time'] ?? '14:00';
        [$hour, $minute] = explode(':', $time);

        switch ($scheduleType) {
            case 'daily':
                $next = $now->copy()->setTime((int)$hour, (int)$minute);
                if ($next->isPast()) {
                    $next->addDay();
                }
                return $next;

            case 'weekly':
                $daysOfWeek = $config['days'] ?? [1]; // 1 = Monday, 7 = Sunday
                $next = null;
                foreach ($daysOfWeek as $day) {
                    // Convert day number (1-7, Monday=1, Sunday=7) to Carbon dayOfWeek (0-6, Sunday=0, Monday=1)
                    $carbonDayOfWeek = $day === 7 ? 0 : $day;
                    
                    // Calculate next occurrence of this day
                    $candidate = $now->copy()->setTime((int)$hour, (int)$minute);
                    
                    // Get current day of week (0=Sunday, 1=Monday, etc.)
                    $currentDayOfWeek = $candidate->dayOfWeek;
                    
                    // Calculate days until next occurrence
                    $daysUntil = ($carbonDayOfWeek - $currentDayOfWeek + 7) % 7;
                    
                    // If it's today and time hasn't passed, use today
                    if ($daysUntil === 0 && !$candidate->isPast()) {
                        // Already set to today
                    } else {
                        // If it's today but time passed, or it's a future day, add days
                        if ($daysUntil === 0) {
                            $daysUntil = 7; // Next week
                        }
                        $candidate->addDays($daysUntil);
                    }
                    
                    if (!$next || $candidate->lt($next)) {
                        $next = $candidate;
                    }
                }
                return $next;

            case 'monthly':
                $dayOfMonth = $config['day'] ?? 1;
                $next = $now->copy()->day($dayOfMonth)->setTime((int)$hour, (int)$minute);
                if ($next->isPast()) {
                    $next->addMonth();
                }
                return $next;

            default:
                return $scheduledAt ? Carbon::parse($scheduledAt) : null;
        }
    }
}
