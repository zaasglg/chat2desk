<?php

namespace App\Services;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    /**
     * Process incoming Telegram update
     */
    public function processUpdate(Channel $channel, array $update): void
    {
        // Handle callback query (button click)
        if (isset($update['callback_query'])) {
            $this->handleCallbackQuery($channel, $update['callback_query']);
        }

        // Handle message
        if (isset($update['message'])) {
            $this->handleMessage($channel, $update['message']);
        }

        // Handle edited message
        if (isset($update['edited_message'])) {
            $this->handleMessage($channel, $update['edited_message'], true);
        }
    }

    /**
     * Get updates using long polling
     */
    public function getUpdates(Channel $channel, int $offset = 0, int $timeout = 30): array
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return [];
        }

        try {
            $response = Http::timeout($timeout + 5)->get(
                "https://api.telegram.org/bot{$botToken}/getUpdates",
                [
                    'offset' => $offset,
                    'timeout' => $timeout,
                    'allowed_updates' => ['message', 'edited_message', 'callback_query'],
                ]
            );

            if ($response->successful() && $response->json('ok')) {
                return $response->json('result', []);
            }
        } catch (\Exception $e) {
            Log::error('Telegram getUpdates error', [
                'channel_id' => $channel->id,
                'error' => $e->getMessage(),
            ]);
        }

        return [];
    }

    /**
     * Delete webhook (required before using long polling)
     */
    public function deleteWebhook(Channel $channel): bool
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return false;
        }

        try {
            $response = Http::post("https://api.telegram.org/bot{$botToken}/deleteWebhook");
            return $response->successful() && $response->json('ok');
        } catch (\Exception $e) {
            Log::error('Telegram deleteWebhook error', [
                'channel_id' => $channel->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Send message to Telegram
     */
    public function sendMessage(Channel $channel, int $chatId, string $text, ?array $inlineKeyboard = null): ?array
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return null;
        }

        try {
            $params = [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'HTML',
            ];

            // Add inline keyboard if provided
            if ($inlineKeyboard !== null && !empty($inlineKeyboard)) {
                $params['reply_markup'] = [
                    'inline_keyboard' => $inlineKeyboard,
                ];
            }

            $response = Http::post("https://api.telegram.org/bot{$botToken}/sendMessage", $params);

            if ($response->successful() && $response->json('ok')) {
                return $response->json('result');
            }
        } catch (\Exception $e) {
            Log::error('Telegram sendMessage error', [
                'channel_id' => $channel->id,
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Send photo to Telegram with optional inline keyboard
     */
    public function sendPhoto(Channel $channel, int $chatId, string $photo, string $caption = '', ?array $inlineKeyboard = null): ?array
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return null;
        }

        try {
            // Check if photo is a local file path
            $isLocalFile = !str_starts_with($photo, 'http') && !str_starts_with($photo, 'tg://');
            
            if ($isLocalFile) {
                // Convert storage path to absolute path
                if (str_starts_with($photo, '/storage/')) {
                    $filePath = public_path($photo);
                } elseif (str_starts_with($photo, 'storage/')) {
                    $filePath = public_path('/' . $photo);
                } else {
                    $filePath = storage_path('app/public/' . $photo);
                }
                
                Log::info('Sending local file as photo', [
                    'original_path' => $photo,
                    'file_path' => $filePath,
                    'exists' => file_exists($filePath)
                ]);
                
                if (!file_exists($filePath)) {
                    Log::error('Photo file not found', ['path' => $filePath]);
                    return null;
                }
                
                // Upload file as multipart
                $params = [
                    'chat_id' => $chatId,
                ];
                
                if ($caption) {
                    $params['caption'] = $caption;
                    $params['parse_mode'] = 'HTML';
                }
                
                // Add inline keyboard if provided (must be JSON string for multipart)
                if ($inlineKeyboard !== null && !empty($inlineKeyboard)) {
                    $params['reply_markup'] = json_encode([
                        'inline_keyboard' => $inlineKeyboard,
                    ]);
                }
                
                $response = Http::attach(
                    'photo',
                    file_get_contents($filePath),
                    basename($filePath)
                )->post("https://api.telegram.org/bot{$botToken}/sendPhoto", $params);
            } else {
                // Send as URL
                $params = [
                    'chat_id' => $chatId,
                    'photo' => $photo,
                ];
                
                if ($caption) {
                    $params['caption'] = $caption;
                    $params['parse_mode'] = 'HTML';
                }
                
                // Add inline keyboard if provided
                if ($inlineKeyboard !== null && !empty($inlineKeyboard)) {
                    $params['reply_markup'] = [
                        'inline_keyboard' => $inlineKeyboard,
                    ];
                }

                $response = Http::post("https://api.telegram.org/bot{$botToken}/sendPhoto", $params);
            }

            if ($response->successful() && $response->json('ok')) {
                return $response->json('result');
            } else {
                Log::error('Telegram sendPhoto failed', [
                    'response' => $response->json(),
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Telegram sendPhoto error', [
                'channel_id' => $channel->id,
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Send video to Telegram
     */
    public function sendVideo(Channel $channel, int $chatId, string $video, string $caption = ''): ?array
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return null;
        }

        try {
            // Check if video is a local file path
            $isLocalFile = !str_starts_with($video, 'http') && !str_starts_with($video, 'tg://');
            
            if ($isLocalFile) {
                // Convert storage path to absolute path
                if (str_starts_with($video, '/storage/')) {
                    $filePath = public_path($video);
                } elseif (str_starts_with($video, 'storage/')) {
                    $filePath = public_path('/' . $video);
                } else {
                    $filePath = storage_path('app/public/' . $video);
                }
                
                Log::info('Sending local file as video', [
                    'original_path' => $video,
                    'file_path' => $filePath,
                    'exists' => file_exists($filePath)
                ]);
                
                if (!file_exists($filePath)) {
                    Log::error('Video file not found', ['path' => $filePath]);
                    return null;
                }
                
                // Upload file as multipart
                $response = Http::attach(
                    'video',
                    file_get_contents($filePath),
                    basename($filePath)
                )->post("https://api.telegram.org/bot{$botToken}/sendVideo", [
                    'chat_id' => $chatId,
                    'caption' => $caption ?: null,
                    'parse_mode' => $caption ? 'HTML' : null,
                ]);
            } else {
                // Send as URL
                $params = [
                    'chat_id' => $chatId,
                    'video' => $video,
                ];
                
                if ($caption) {
                    $params['caption'] = $caption;
                    $params['parse_mode'] = 'HTML';
                }

                $response = Http::post("https://api.telegram.org/bot{$botToken}/sendVideo", $params);
            }

            if ($response->successful() && $response->json('ok')) {
                return $response->json('result');
            } else {
                Log::error('Telegram sendVideo failed', [
                    'response' => $response->json(),
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Telegram sendVideo error', [
                'channel_id' => $channel->id,
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Send document to Telegram
     */
    public function sendDocument(Channel $channel, int $chatId, string $document, string $caption = ''): ?array
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return null;
        }

        try {
            // Check if document is a local file path
            $isLocalFile = !str_starts_with($document, 'http') && !str_starts_with($document, 'tg://');
            
            if ($isLocalFile) {
                // Convert storage path to absolute path
                if (str_starts_with($document, '/storage/')) {
                    $filePath = public_path($document);
                } elseif (str_starts_with($document, 'storage/')) {
                    $filePath = public_path('/' . $document);
                } else {
                    $filePath = storage_path('app/public/' . $document);
                }
                
                Log::info('Sending local file as document', [
                    'original_path' => $document,
                    'file_path' => $filePath,
                    'exists' => file_exists($filePath)
                ]);
                
                if (!file_exists($filePath)) {
                    Log::error('Document file not found', ['path' => $filePath]);
                    return null;
                }
                
                // Upload file as multipart
                $response = Http::attach(
                    'document',
                    file_get_contents($filePath),
                    basename($filePath)
                )->post("https://api.telegram.org/bot{$botToken}/sendDocument", [
                    'chat_id' => $chatId,
                    'caption' => $caption ?: null,
                    'parse_mode' => $caption ? 'HTML' : null,
                ]);
            } else {
                // Send as URL
                $params = [
                    'chat_id' => $chatId,
                    'document' => $document,
                ];
                
                if ($caption) {
                    $params['caption'] = $caption;
                    $params['parse_mode'] = 'HTML';
                }

                $response = Http::post("https://api.telegram.org/bot{$botToken}/sendDocument", $params);
            }

            if ($response->successful() && $response->json('ok')) {
                return $response->json('result');
            } else {
                Log::error('Telegram sendDocument failed', [
                    'response' => $response->json(),
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Telegram sendDocument error', [
                'channel_id' => $channel->id,
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Handle incoming message
     */
    public function handleMessage(Channel $channel, array $message, bool $isEdited = false): void
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
        $isNewChat = false;
        $chat = Chat::where('channel_id', $channel->id)
            ->where('client_id', $client->id)
            ->first();
            
        if (!$chat) {
            $chat = Chat::create([
                'channel_id' => $channel->id,
                'client_id' => $client->id,
                'status' => 'new',
                'priority' => 'normal',
                'last_message_at' => now(),
                'metadata' => [
                    'telegram_chat_id' => $message['chat']['id'],
                ],
            ]);
            $isNewChat = true;
        }

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
        $newMessage = Message::create([
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

        Log::info('Telegram message processed', [
            'channel_id' => $channel->id,
            'chat_id' => $chat->id,
            'client' => $client->name,
            'content' => mb_substr($content, 0, 50),
        ]);

        // Check for paused automation first
        $automationService = app(AutomationService::class);
        $automationService->checkPausedAutomation($chat, $newMessage);
        
        // Trigger automations
        $this->triggerAutomations($chat, $newMessage, $isNewChat);
    }

    /**
     * Trigger automations for chat/message
     */
    protected function triggerAutomations(Chat $chat, Message $message, bool $isNewChat): void
    {
        try {
            $automationService = app(AutomationService::class);

            // Trigger new_chat automation
            if ($isNewChat) {
                $automationService->triggerNewChat($chat);
            }

            // Trigger keyword automation
            $automationService->triggerKeyword($chat, $message);

        } catch (\Exception $e) {
            Log::error('Automation trigger error', [
                'chat_id' => $chat->id,
                'error' => $e->getMessage(),
            ]);
        }
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

        if (isset($message['photo'])) {
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

    /**
     * Handle callback query (button click)
     */
    public function handleCallbackQuery(Channel $channel, array $callbackQuery): void
    {
        $telegramUser = $callbackQuery['from'] ?? null;
        if (!$telegramUser) {
            return;
        }

        $callbackData = $callbackQuery['data'] ?? '';
        $message = $callbackQuery['message'] ?? null;
        $chatId = $message['chat']['id'] ?? null;

        if (!$chatId || !$callbackData) {
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

        // Get or create chat
        $chat = Chat::where('channel_id', $channel->id)
            ->where('client_id', $client->id)
            ->first();

        if (!$chat) {
            $chat = Chat::create([
                'channel_id' => $channel->id,
                'client_id' => $client->id,
                'status' => 'new',
                'priority' => 'normal',
                'last_message_at' => now(),
                'metadata' => [
                    'telegram_chat_id' => $chatId,
                ],
            ]);
        }

        // Update chat metadata
        $metadata = $chat->metadata ?? [];
        if (!isset($metadata['telegram_chat_id'])) {
            $metadata['telegram_chat_id'] = $chatId;
            $chat->update(['metadata' => $metadata]);
        }

        // Answer callback query to remove loading state
        $this->answerCallbackQuery($channel, $callbackQuery['id']);

        // If callback_data starts with "step_", it's a step trigger
        if (str_starts_with($callbackData, 'step_')) {
            $stepId = str_replace('step_', '', $callbackData);
            $this->executeStepFromCallback($chat, $stepId, $channel);
        }

        Log::info('Callback query processed', [
            'channel_id' => $channel->id,
            'chat_id' => $chat->id,
            'callback_data' => $callbackData,
        ]);
    }

    /**
     * Answer callback query
     */
    protected function answerCallbackQuery(Channel $channel, string $callbackQueryId, ?string $text = null, bool $showAlert = false): void
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return;
        }

        try {
            $params = [
                'callback_query_id' => $callbackQueryId,
            ];

            if ($text !== null) {
                $params['text'] = $text;
                $params['show_alert'] = $showAlert;
            }

            Http::post("https://api.telegram.org/bot{$botToken}/answerCallbackQuery", $params);
        } catch (\Exception $e) {
            Log::error('Telegram answerCallbackQuery error', [
                'channel_id' => $channel->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Execute step from callback button
     */
    protected function executeStepFromCallback(Chat $chat, string $stepId, Channel $channel): void
    {
        // Find the automation that contains this step
        $automationStep = \App\Models\AutomationStep::where('step_id', $stepId)
            ->with('automation')
            ->first();

        if (!$automationStep || !$automationStep->automation) {
            Log::warning('Step not found for callback', [
                'step_id' => $stepId,
                'chat_id' => $chat->id,
            ]);
            return;
        }

        $automation = $automationStep->automation;

        // Check if automation is active
        if (!$automation->is_active) {
            Log::info('Automation is not active, skipping step execution', [
                'automation_id' => $automation->id,
                'step_id' => $stepId,
            ]);
            return;
        }

        // Execute the step using AutomationService
        $automationService = app(\App\Services\AutomationService::class);
        $automationService->executeStep($automationStep, $chat);

        Log::info('Step executed from callback', [
            'automation_id' => $automation->id,
            'step_id' => $stepId,
            'chat_id' => $chat->id,
        ]);
    }
}
