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

        $query = Chat::with(['client', 'channel', 'operator', 'latestMessage'])
            ->whereIn('channel_id', $activeChannelIds)
            ->orderBy('last_message_at', 'desc');

        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by channel
        if ($request->has('channel_id') && $request->channel_id) {
            $query->where('channel_id', $request->channel_id);
        }

        // Filter by operator
        if ($request->has('operator_id')) {
            if ($request->operator_id === 'unassigned') {
                $query->whereNull('operator_id');
            } elseif ($request->operator_id) {
                $query->where('operator_id', $request->operator_id);
            }
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

        $chats = $query->paginate(50);
        
        // Only show active Telegram channels
        $channels = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->get();

        // Stats - only for active channels
        $stats = [
            'new' => Chat::whereIn('channel_id', $activeChannelIds)->where('status', 'new')->count(),
            'open' => Chat::whereIn('channel_id', $activeChannelIds)->where('status', 'open')->count(),
            'pending' => Chat::whereIn('channel_id', $activeChannelIds)->where('status', 'pending')->count(),
            'resolved' => Chat::whereIn('channel_id', $activeChannelIds)->where('status', 'resolved')->count(),
            'unassigned' => Chat::whereIn('channel_id', $activeChannelIds)->whereNull('operator_id')->whereIn('status', ['new', 'open'])->count(),
        ];

        return Inertia::render('chats/index', [
            'chats' => $chats,
            'channels' => $channels,
            'stats' => $stats,
            'filters' => $request->only(['status', 'channel_id', 'operator_id', 'search']),
        ]);
    }

    public function show(Chat $chat)
    {
        $chat->load(['client.tags', 'channel', 'operator', 'messages.operator']);

        // Mark messages as read
        $chat->messages()
            ->where('direction', 'incoming')
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'status' => 'read']);

        $chat->update(['unread_count' => 0]);

        $allTags = \App\Models\Tag::orderBy('name')->get();

        return Inertia::render('chats/show', [
            'chat' => $chat,
            'allTags' => $allTags,
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
            $chat->update([
                'operator_id' => $request->operator_id,
                'operator_group_id' => null,
                'status' => 'open',
            ]);
            return back()->with('success', 'Чат назначен оператору');
        }

        // If operator_group_id provided, assign to group and clear operator
        if ($request->filled('operator_group_id')) {
            $chat->update([
                'operator_group_id' => $request->operator_group_id,
                'operator_id' => null,
                'status' => 'open',
            ]);
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

        $chat->update(['status' => $request->status]);

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
}
