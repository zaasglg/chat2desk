<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Message;
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

        $message = Message::create([
            'chat_id' => $chat->id,
            'channel_id' => $chat->channel_id,
            'operator_id' => auth()->id(),
            'direction' => 'outgoing',
            'type' => $request->type ?? 'text',
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

        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            Log::error('Telegram: bot token not found', ['channel_id' => $channel->id]);
            return false;
        }

        // Get telegram chat_id from chat metadata
        $metadata = $chat->metadata ?? [];
        $telegramChatId = $metadata['telegram_chat_id'] ?? null;

        if (!$telegramChatId) {
            Log::error('Telegram: chat_id not found', ['chat_id' => $chat->id]);
            return false;
        }

        try {
            $response = Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id' => $telegramChatId,
                'text' => $message->content,
                'parse_mode' => 'HTML',
            ]);

            if ($response->successful() && $response->json('ok')) {
                $result = $response->json('result');
                $message->update([
                    'metadata' => array_merge($message->metadata ?? [], [
                        'telegram_message_id' => $result['message_id'],
                    ]),
                ]);
                return true;
            }

            Log::error('Telegram: failed to send message', [
                'chat_id' => $chat->id,
                'response' => $response->json(),
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
