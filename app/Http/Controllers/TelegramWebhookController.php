<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    public function handle(Request $request, string $token)
    {
        // Find channel by webhook token
        $channel = Channel::where('type', 'telegram')
            ->where('is_active', true)
            ->get()
            ->first(function ($ch) use ($token) {
                $credentials = $ch->credentials ?? [];
                return ($credentials['webhook_token'] ?? null) === $token;
            });

        if (!$channel) {
            Log::warning('Telegram webhook: channel not found for token', ['token' => substr($token, 0, 10) . '...']);
            return response()->json(['ok' => true]);
        }

        $update = $request->all();
        Log::info('Telegram webhook received', ['channel' => $channel->id, 'update' => $update]);

        // Handle message
        if (isset($update['message'])) {
            $this->handleMessage($channel, $update['message']);
        }

        // Handle edited message
        if (isset($update['edited_message'])) {
            $this->handleMessage($channel, $update['edited_message'], true);
        }

        return response()->json(['ok' => true]);
    }

    protected function handleMessage(Channel $channel, array $message, bool $isEdited = false)
    {
        $telegramUser = $message['from'] ?? null;
        if (!$telegramUser) {
            return;
        }

        // Get or create client
        $client = Client::firstOrCreate(
            ['external_id' => 'tg_' . $telegramUser['id']],
            [
                'name' => trim(($telegramUser['first_name'] ?? '') . ' ' . ($telegramUser['last_name'] ?? '')),
                'avatar' => null,
                'metadata' => [
                    'telegram_id' => $telegramUser['id'],
                    'telegram_username' => $telegramUser['username'] ?? null,
                    'telegram_language' => $telegramUser['language_code'] ?? null,
                ],
            ]
        );

        // Update client name if changed
        $newName = trim(($telegramUser['first_name'] ?? '') . ' ' . ($telegramUser['last_name'] ?? ''));
        if ($client->name !== $newName && $newName) {
            $client->update(['name' => $newName]);
        }

        // Get or create chat
        $chat = Chat::firstOrCreate(
            [
                'channel_id' => $channel->id,
                'client_id' => $client->id,
            ],
            [
                'status' => 'new',
                'priority' => 'normal',
                'last_message_at' => now(),
                'metadata' => [
                    'telegram_chat_id' => $message['chat']['id'],
                ],
            ]
        );

        // Update chat metadata with telegram_chat_id if not set
        $metadata = $chat->metadata ?? [];
        if (!isset($metadata['telegram_chat_id'])) {
            $metadata['telegram_chat_id'] = $message['chat']['id'];
            $chat->update(['metadata' => $metadata]);
        }

        // Update chat status and last message time
        $chatData = ['last_message_at' => now()];
        if ($chat->status === 'resolved') {
            $chatData['status'] = 'open';
        }
        $chat->update($chatData);

        // Parse message content
        $content = $this->parseMessageContent($message);
        $attachments = $this->parseAttachments($message);

        // Check if message already exists (for edited messages)
        $existingMessage = Message::where('metadata->telegram_message_id', $message['message_id'])
            ->where('chat_id', $chat->id)
            ->first();

        if ($existingMessage) {
            // Update existing message if edited
            if ($isEdited) {
                $existingMessage->update([
                    'content' => $content,
                    'metadata' => array_merge($existingMessage->metadata ?? [], ['edited' => true]),
                ]);
            }
            return;
        }

        // Create message
        Message::create([
            'chat_id' => $chat->id,
            'channel_id' => $channel->id,
            'client_id' => $client->id,
            'operator_id' => null,
            'direction' => 'incoming',
            'content' => $content,
            'type' => $this->getMessageType($message),
            'attachments' => $attachments,
            'metadata' => [
                'telegram_message_id' => $message['message_id'],
                'telegram_chat_id' => $message['chat']['id'],
                'telegram_date' => $message['date'],
            ],
        ]);

        // Increment unread count
        $chat->increment('unread_count');
    }

    protected function parseMessageContent(array $message): string
    {
        if (isset($message['text'])) {
            return $message['text'];
        }

        if (isset($message['caption'])) {
            return $message['caption'];
        }

        if (isset($message['sticker'])) {
            return $message['sticker']['emoji'] ?? '🎭 Стикер';
        }

        if (isset($message['photo'])) {
            return '📷 Фото';
        }

        if (isset($message['video'])) {
            return '🎬 Видео';
        }

        if (isset($message['voice'])) {
            return '🎤 Голосовое сообщение';
        }

        if (isset($message['audio'])) {
            return '🎵 Аудио';
        }

        if (isset($message['document'])) {
            return '📎 ' . ($message['document']['file_name'] ?? 'Документ');
        }

        if (isset($message['location'])) {
            return '📍 Локация';
        }

        if (isset($message['contact'])) {
            return '👤 Контакт: ' . ($message['contact']['first_name'] ?? 'Контакт');
        }

        return '';
    }

    protected function parseAttachments(array $message): array
    {
        $attachments = [];
        $credentials = null;

        if (isset($message['photo'])) {
            // Get the largest photo
            $photo = end($message['photo']);
            $attachments[] = [
                'type' => 'photo',
                'file_id' => $photo['file_id'],
                'file_unique_id' => $photo['file_unique_id'],
                'width' => $photo['width'] ?? null,
                'height' => $photo['height'] ?? null,
            ];
        }

        if (isset($message['video'])) {
            $attachments[] = [
                'type' => 'video',
                'file_id' => $message['video']['file_id'],
                'file_unique_id' => $message['video']['file_unique_id'],
                'duration' => $message['video']['duration'] ?? null,
                'file_name' => $message['video']['file_name'] ?? null,
            ];
        }

        if (isset($message['voice'])) {
            $attachments[] = [
                'type' => 'voice',
                'file_id' => $message['voice']['file_id'],
                'file_unique_id' => $message['voice']['file_unique_id'],
                'duration' => $message['voice']['duration'] ?? null,
            ];
        }

        if (isset($message['audio'])) {
            $attachments[] = [
                'type' => 'audio',
                'file_id' => $message['audio']['file_id'],
                'file_unique_id' => $message['audio']['file_unique_id'],
                'duration' => $message['audio']['duration'] ?? null,
                'title' => $message['audio']['title'] ?? null,
                'performer' => $message['audio']['performer'] ?? null,
            ];
        }

        if (isset($message['document'])) {
            $attachments[] = [
                'type' => 'document',
                'file_id' => $message['document']['file_id'],
                'file_unique_id' => $message['document']['file_unique_id'],
                'file_name' => $message['document']['file_name'] ?? null,
                'mime_type' => $message['document']['mime_type'] ?? null,
            ];
        }

        if (isset($message['sticker'])) {
            $attachments[] = [
                'type' => 'sticker',
                'file_id' => $message['sticker']['file_id'],
                'file_unique_id' => $message['sticker']['file_unique_id'],
                'emoji' => $message['sticker']['emoji'] ?? null,
                'set_name' => $message['sticker']['set_name'] ?? null,
            ];
        }

        if (isset($message['location'])) {
            $attachments[] = [
                'type' => 'location',
                'latitude' => $message['location']['latitude'],
                'longitude' => $message['location']['longitude'],
            ];
        }

        if (isset($message['contact'])) {
            $attachments[] = [
                'type' => 'contact',
                'phone_number' => $message['contact']['phone_number'],
                'first_name' => $message['contact']['first_name'],
                'last_name' => $message['contact']['last_name'] ?? null,
            ];
        }

        return $attachments;
    }

    protected function getMessageType(array $message): string
    {
        if (isset($message['text'])) return 'text';
        if (isset($message['photo'])) return 'photo';
        if (isset($message['video'])) return 'video';
        if (isset($message['voice'])) return 'voice';
        if (isset($message['audio'])) return 'audio';
        if (isset($message['document'])) return 'document';
        if (isset($message['sticker'])) return 'sticker';
        if (isset($message['location'])) return 'location';
        if (isset($message['contact'])) return 'contact';

        return 'text';
    }
}
