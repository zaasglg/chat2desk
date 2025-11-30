<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;

class BroadcastController extends Controller
{
    public function create()
    {
        return Inertia::render('broadcasts/create', [
            'channels' => \App\Models\Channel::all()->map(function($c){
                return ['id' => $c->id, 'name' => $c->name, 'type' => $c->type];
            }),
        ]);
    }

    public function store(Request $request, TelegramService $telegramService)
    {
        $data = $request->validate([
            'content' => 'required|string',
            'channel_id' => 'nullable|exists:channels,id',
        ]);

        $channelFilter = $data['channel_id'] ?? null;

        // Query chats that have a channel and a client
        $query = Chat::with('channel')->whereNotNull('client_id');
        if ($channelFilter) {
            $query->where('channel_id', $channelFilter);
        }

        $sent = 0;
        $failed = 0;

        // Process in chunks to avoid memory issues
        $query->chunk(200, function($chats) use ($data, $telegramService, &$sent, &$failed) {
            foreach ($chats as $chat) {
                $channel = $chat->channel;
                // For now, only support Telegram broadcasts (channels with telegram bot token and chat metadata)
                $metadata = $chat->metadata ?? [];
                $telegramChatId = $metadata['telegram_chat_id'] ?? null;

                // Create message record first (pending)
                $message = Message::create([
                    'chat_id' => $chat->id,
                    'channel_id' => $chat->channel_id,
                    'operator_id' => null,
                    'direction' => 'outgoing',
                    'type' => 'text',
                    'content' => $data['content'],
                    'status' => 'pending',
                    'metadata' => ['sent_by' => 'broadcast'],
                ]);

                $ok = false;

                if ($channel && $channel->type === 'telegram' && $telegramChatId) {
                    $result = $telegramService->sendMessage($channel, $telegramChatId, $data['content']);
                    if ($result) {
                        $ok = true;
                        $message->update([
                            'status' => 'sent',
                            'metadata' => array_merge($message->metadata ?? [], ['telegram_message_id' => $result['message_id'] ?? null, 'sent_by' => 'broadcast']),
                        ]);
                        $sent++;
                    }
                }

                if (!$ok) {
                    $failed++;
                    $message->update(['status' => 'failed']);
                }
            }
        });

        Log::info('Broadcast completed', ['sent' => $sent, 'failed' => $failed]);

        return redirect()->back()->with('success', "Broadcast queued: sent={$sent}, failed={$failed}");
    }
}
