<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class MessageController extends Controller
{
    public function index(Chat $chat)
    {
        $messages = $chat->messages()
            ->with(['operator', 'client', 'replyTo'])
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    public function store(Request $request, Chat $chat)
    {
        $request->validate([
            'content' => 'required_without:attachments|string|nullable',
            'type' => 'sometimes|in:text,image,file,audio,video',
            'attachments' => 'sometimes|array',
            'attachments.*' => 'file|max:20480', // 20MB max
            'reply_to_id' => 'nullable|exists:messages,id',
        ]);

        $attachments = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $path = $file->store('attachments', 'public');
                $attachments[] = [
                    'path' => $path,
                    'name' => $file->getClientOriginalName(),
                    'mime' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ];
            }
        }

        // Determine message type based on attachments if not provided
        $messageType = $request->type ?? 'text';
        if (!$request->type && !empty($attachments)) {
            $firstAttachment = $attachments[0];
            $mimeType = $firstAttachment['mime'] ?? '';
            
            if (str_starts_with($mimeType, 'image/')) {
                $messageType = 'image';
            } elseif (str_starts_with($mimeType, 'video/')) {
                $messageType = 'video';
            } elseif (str_starts_with($mimeType, 'audio/')) {
                $messageType = 'audio';
            } else {
                $messageType = 'file';
            }
        }

        $message = Message::create([
            'chat_id' => $chat->id,
            'channel_id' => $chat->channel_id,
            'operator_id' => auth()->id(),
            'direction' => 'outgoing',
            'type' => $messageType,
            'content' => $request->content,
            'attachments' => $attachments ?: null,
            'reply_to_id' => $request->reply_to_id,
            'status' => 'pending',
        ]);

        // Send to Telegram
        $sent = $this->sendToTelegram($chat, $message);
        $message->update(['status' => $sent ? 'sent' : 'failed']);

        // Update chat
        $chat->update([
            'last_message_at' => now(),
            'status' => $chat->status === 'new' ? 'open' : $chat->status,
        ]);

        $message->load(['operator', 'replyTo']);

        return response()->json($message, 201);
    }

    protected function sendToTelegram(Chat $chat, Message $message): bool
    {
        $channel = $chat->channel;
        if (!$channel || $channel->type !== 'telegram') {
            return false;
        }

        // Get telegram chat_id from chat metadata
        $metadata = $chat->metadata ?? [];
        $telegramChatId = $metadata['telegram_chat_id'] ?? null;

        if (!$telegramChatId) {
            Log::error('Telegram: chat_id not found', ['chat_id' => $chat->id]);
            return false;
        }

        $telegramService = app(\App\Services\TelegramService::class);
        $result = null;

        try {
            // Handle different message types
            if ($message->attachments && count($message->attachments) > 0) {
                $attachment = $message->attachments[0]; // Take first attachment
                $filePath = $attachment['path'] ?? null;
                $caption = $message->content ?? '';

                if ($filePath) {
                    // Determine file type by MIME type or extension
                    $mimeType = $attachment['mime'] ?? '';
                    $isImage = str_starts_with($mimeType, 'image/') || 
                              in_array(strtolower(pathinfo($filePath, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'gif', 'webp']);
                    $isVideo = str_starts_with($mimeType, 'video/') || 
                              in_array(strtolower(pathinfo($filePath, PATHINFO_EXTENSION)), ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']);

                    if ($isImage) {
                        $result = $telegramService->sendPhoto($channel, $telegramChatId, $filePath, $caption);
                    } elseif ($isVideo) {
                        $result = $telegramService->sendVideo($channel, $telegramChatId, $filePath, $caption);
                    } else {
                        $result = $telegramService->sendDocument($channel, $telegramChatId, $filePath, $caption);
                    }
                }
            } else {
                // Send text message
                $result = $telegramService->sendMessage($channel, $telegramChatId, $message->content ?? '');
            }

            if ($result) {
                $message->update([
                    'metadata' => array_merge($message->metadata ?? [], [
                        'telegram_message_id' => $result['message_id'] ?? null,
                    ]),
                ]);
                return true;
            }

            Log::error('Telegram: failed to send message', [
                'chat_id' => $chat->id,
                'message_type' => $message->type,
            ]);
            return false;
        } catch (\Exception $e) {
            Log::error('Telegram: exception', [
                'chat_id' => $chat->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function destroy(Message $message)
    {
        // Delete attachments
        if ($message->attachments) {
            foreach ($message->attachments as $attachment) {
                Storage::disk('public')->delete($attachment['path']);
            }
        }

        $message->delete();

        return response()->json(['success' => true]);
    }
}
