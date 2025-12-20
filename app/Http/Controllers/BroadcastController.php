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
            'tags' => \App\Models\Tag::all(),
        ]);
    }

    public function store(Request $request, TelegramService $telegramService)
    {
        $data = $request->validate([
            'content' => 'required|string',
            'channel_id' => 'nullable|exists:channels,id',
            'has_tag_ids' => 'nullable|array',
            'has_tag_ids.*' => 'exists:tags,id',
            'not_has_tag_ids' => 'nullable|array',
            'not_has_tag_ids.*' => 'exists:tags,id',
            'image' => 'nullable|image|max:10240', // max 10MB
        ]);

        $channelFilter = $data['channel_id'] ?? null;
        $hasTagIds = $data['has_tag_ids'] ?? [];
        $notHasTagIds = $data['not_has_tag_ids'] ?? [];
        
        // Handle image upload
        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('broadcast_images', 'public');
        }

        // Query chats that have a channel and a client
        $query = Chat::with('channel', 'client.tags')->whereNotNull('client_id');
        if ($channelFilter) {
            $query->where('channel_id', $channelFilter);
        }

        // Apply tag filters
        if (!empty($hasTagIds)) {
            // Клиенты, у которых есть хотя бы один из выбранных тегов
            $query->whereHas('client.tags', function($q) use ($hasTagIds) {
                $q->whereIn('tags.id', $hasTagIds);
            });
        }
        
        if (!empty($notHasTagIds)) {
            // Клиенты, у которых нет ни одного из выбранных тегов
            $query->whereDoesntHave('client.tags', function($q) use ($notHasTagIds) {
                $q->whereIn('tags.id', $notHasTagIds);
            });
        }

        $sent = 0;
        $failed = 0;

        // Process in chunks to avoid memory issues
        $query->chunk(200, function($chats) use ($data, $telegramService, $imagePath, &$sent, &$failed) {
            foreach ($chats as $chat) {
                $channel = $chat->channel;
                // For now, only support Telegram broadcasts (channels with telegram bot token and chat metadata)
                $metadata = $chat->metadata ?? [];
                $telegramChatId = $metadata['telegram_chat_id'] ?? null;

                // Create message record first (pending)
                $messageType = $imagePath ? 'image' : 'text';
                $message = Message::create([
                    'chat_id' => $chat->id,
                    'channel_id' => $chat->channel_id,
                    'operator_id' => null,
                    'direction' => 'outgoing',
                    'type' => $messageType,
                    'content' => $data['content'],
                    'status' => 'pending',
                    'metadata' => ['sent_by' => 'broadcast'],
                ]);

                $ok = false;

                if ($channel && $channel->type === 'telegram' && $telegramChatId) {
                    if ($imagePath) {
                        // Отправляем фото с подписью
                        $result = $telegramService->sendPhoto($channel, $telegramChatId, $imagePath, $data['content']);
                    } else {
                        // Отправляем только текст
                        $result = $telegramService->sendMessage($channel, $telegramChatId, $data['content']);
                    }
                    
                    if ($result) {
                        $ok = true;
                        $message->update([
                            'status' => 'sent',
                            'metadata' => array_merge($message->metadata ?? [], [
                                'telegram_message_id' => $result['message_id'] ?? null, 
                                'sent_by' => 'broadcast',
                                'image_path' => $imagePath,
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
        });

        Log::info('Broadcast completed', ['sent' => $sent, 'failed' => $failed]);

        return redirect()->back()->with('success', "Broadcast queued: sent={$sent}, failed={$failed}");
    }
}
