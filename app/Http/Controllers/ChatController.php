<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Channel;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ChatController extends Controller
{
    public function index(Request $request)
    {
        // Get only active Telegram channels
        $activeChannelIds = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->pluck('id');

        $query = Chat::with(['client.tags', 'channel', 'operator', 'latestMessage'])
            ->whereIn('channel_id', $activeChannelIds)
            ->orderBy('last_message_at', 'desc');

        $user = auth()->user();
        $isAdmin = $user && $user->role === 'admin';

        // Filter by category
        $category = $request->get('category', 'all');
        
        if ($category === 'unread') {
            // Непрочитанные чаты: чаты с непрочитанными входящими сообщениями
            $query->whereHas('messages', function ($q) {
                $q->where('direction', 'incoming')
                  ->whereNull('read_at');
            });
        }

        // Filter by user role
        if (!$isAdmin) {
            // Для оператора показываем только его чаты
            $query->where('operator_id', $user->id);
        }

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->whereHas('client', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $firstChat = $query->first();
        
        if ($firstChat) {
            // Redirect to first chat with filters
            $params = array_merge(
                ['chat' => $firstChat->id],
                $request->only(['category', 'search'])
            );
            return redirect()->route('chats.show', $params);
        }

        // If no chats, show empty state
        $channels = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->get();

        // Calculate stats
        $baseQuery = Chat::whereIn('channel_id', $activeChannelIds);
        if (!$isAdmin) {
            $baseQuery->where('operator_id', $user->id);
        }

        $allChatsCount = (clone $baseQuery)->count();
        $unreadChatsCount = (clone $baseQuery)
            ->whereHas('messages', function ($q) {
                $q->where('direction', 'incoming')
                  ->whereNull('read_at');
            })
            ->count();

        $stats = [
            'all' => $allChatsCount,
            'unread' => $unreadChatsCount,
        ];

        // Create a dummy chat object for empty state
        $emptyChat = new Chat();
        $emptyChat->id = 0;
        $emptyChat->client = null;
        $emptyChat->messages = collect([]);
        $emptyChat->channel = null;
        $emptyChat->operator = null;

        return Inertia::render('chats/show', [
            'chat' => $emptyChat,
            'allTags' => \App\Models\Tag::orderBy('name')->get(),
            'chats' => collect([]),
            'channels' => $channels,
            'stats' => $stats,
            'filters' => $request->only(['category', 'search']),
        ]);
    }

    public function show(Request $request, Chat $chat)
    {
        $chat->load(['client.tags', 'channel', 'operator', 'messages.operator']);

        // Mark messages as read
        $chat->messages()
            ->where('direction', 'incoming')
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'status' => 'read']);

        $chat->update(['unread_count' => 0]);

        $allTags = \App\Models\Tag::orderBy('name')->get();

        // Load chats list for sidebar
        $activeChannelIds = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->pluck('id');

        $chatsQuery = Chat::with(['client.tags', 'channel', 'operator', 'latestMessage'])
            ->whereIn('channel_id', $activeChannelIds);

        $user = auth()->user();
        $isAdmin = $user && $user->role === 'admin';

        // Filter by category
        $category = $request->get('category', 'all');
        
        if ($category === 'unread') {
            // Непрочитанные чаты: чаты с непрочитанными входящими сообщениями
            $chatsQuery->whereHas('messages', function ($q) {
                $q->where('direction', 'incoming')
                  ->whereNull('read_at');
            });
        }

        // Filter by user role
        if (!$isAdmin) {
            // Для оператора показываем только его чаты
            $chatsQuery->where('operator_id', $user->id);
        }
        // Для админа показываем все чаты (без фильтра)

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $chatsQuery->whereHas('client', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $chatsQuery->orderBy('last_message_at', 'desc');

        $chats = $chatsQuery->limit(100)->get();
        
        $channels = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->get();

        // Calculate stats for categories
        $baseQuery = Chat::whereIn('channel_id', $activeChannelIds);
        if (!$isAdmin) {
            $baseQuery->where('operator_id', $user->id);
        }

        $allChatsCount = (clone $baseQuery)->count();
        
        // Непрочитанные: чаты с непрочитанными входящими сообщениями
        $unreadChatsCount = (clone $baseQuery)
            ->whereHas('messages', function ($q) {
                $q->where('direction', 'incoming')
                  ->whereNull('read_at');
            })
            ->count();

        $stats = [
            'all' => $allChatsCount,
            'unread' => $unreadChatsCount,
        ];

        return Inertia::render('chats/show', [
            'chat' => $chat,
            'allTags' => $allTags,
            'chats' => $chats,
            'channels' => $channels,
            'stats' => $stats,
            'filters' => $request->only(['category', 'search']),
        ]);
    }

    public function assign(Request $request, Chat $chat)
    {
        $request->validate([
            'operator_id' => 'nullable|exists:users,id',
            'operator_group_id' => 'nullable|exists:operator_groups,id',
        ]);

        // If operator_id is provided, assign to operator and clear group.
        if ($request->filled('operator_id')) {
            $wasOpen = $chat->status === 'open';
            $chat->update([
                'operator_id' => $request->operator_id,
                'operator_group_id' => null,
                'status' => 'open',
            ]);
            
            // Trigger chat_opened automation if status changed to open
            if (!$wasOpen) {
                $automationService = app(\App\Services\AutomationService::class);
                $automationService->triggerChatOpened($chat);
            }
            
            return back()->with('success', 'Чат назначен оператору');
        }

        // If operator_group_id provided, assign to group and clear operator
        if ($request->filled('operator_group_id')) {
            $wasOpen = $chat->status === 'open';
            $chat->update([
                'operator_group_id' => $request->operator_group_id,
                'operator_id' => null,
                'status' => 'open',
            ]);
            
            // Trigger chat_opened automation if status changed to open
            if (!$wasOpen) {
                $automationService = app(\App\Services\AutomationService::class);
                $automationService->triggerChatOpened($chat);
            }
            
            return back()->with('success', 'Чат передан в группу операторов');
        }

        // If neither provided, unassign
        $chat->update([
            'operator_id' => null,
            'operator_group_id' => null,
            'status' => 'new',
        ]);

        return back()->with('success', 'Чат переведен в не назначенные');
    }

    public function updateStatus(Request $request, Chat $chat)
    {
        $request->validate([
            'status' => 'required|in:new,open,pending,resolved,closed',
        ]);

        $oldStatus = $chat->status;
        $chat->update(['status' => $request->status]);
        
        $automationService = app(\App\Services\AutomationService::class);
        
        // Trigger chat_opened automation if status changed to open
        if ($request->status === 'open' && $oldStatus !== 'open') {
            $automationService->triggerChatOpened($chat);
        }
        
        // Trigger chat_closed automation if status changed to closed
        if ($request->status === 'closed' && $oldStatus !== 'closed') {
            $automationService->triggerChatClosed($chat);
        }

        return back()->with('success', 'Статус обновлен');
    }

    public function updatePriority(Request $request, Chat $chat)
    {
        $request->validate([
            'priority' => 'required|in:low,normal,high,urgent',
        ]);

        $chat->update(['priority' => $request->priority]);

        return back()->with('success', 'Приоритет обновлен');
    }

    public function markAsUnread(Chat $chat)
    {
        // Помечаем последнее входящее сообщение как непрочитанное
        $lastIncomingMessage = $chat->messages()
            ->where('direction', 'incoming')
            ->latest()
            ->first();

        if ($lastIncomingMessage) {
            $lastIncomingMessage->update(['read_at' => null, 'status' => 'delivered']);
        }

        // Увеличиваем счетчик непрочитанных
        $chat->update(['unread_count' => max(1, $chat->unread_count)]);

        return back()->with('success', 'Чат помечен как непрочитанный');
    }
}
