<?php

namespace App\Services;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
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
            
            // Trigger incoming_message automation
            $automationService->triggerIncomingMessage($chat, $message);

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
        Log::info('Callback query received', [
            'channel_id' => $channel->id,
            'callback_query' => $callbackQuery,
        ]);

        // Deduplicate by callback_query id to avoid double-processing on Telegram retries
        $callbackQueryId = $callbackQuery['id'] ?? null;
        if ($callbackQueryId) {
            $cacheKey = 'tg_callback_' . $callbackQueryId;
            if (Cache::has($cacheKey)) {
                Log::info('Callback already processed, skip', ['callback_query_id' => $callbackQueryId]);
                return;
            }
            // keep short TTL (5 minutes) just to avoid duplicates
            Cache::put($cacheKey, true, now()->addMinutes(5));
        }
        
        $telegramUser = $callbackQuery['from'] ?? null;
        if (!$telegramUser) {
            Log::warning('No telegram user in callback query', ['callback_query' => $callbackQuery]);
            return;
        }

        $callbackData = $callbackQuery['data'] ?? '';
        $message = $callbackQuery['message'] ?? null;
        $chatId = $message['chat']['id'] ?? null;

        if (!$chatId || !$callbackData) {
            Log::warning('Missing chat_id or callback_data', [
                'chat_id' => $chatId,
                'callback_data' => $callbackData,
            ]);
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

        // Check if callback_data is a button action (format: step_id:button_index or b{hash}_{index})
        try {
            if (str_contains($callbackData, ':') || (str_starts_with($callbackData, 'b') && str_contains($callbackData, '_'))) {
                Log::info('Processing button action from callback', ['callback_data' => $callbackData]);
                $buttonHasUrl = $this->executeButtonActionFromCallback($chat, $callbackData, $channel, $callbackQuery);
                // Answer callback query after successful execution
                $this->answerCallbackQuery($channel, $callbackQuery['id']);
                
                // Hide buttons after click (except for URL buttons)
                if (!$buttonHasUrl && isset($message['message_id'])) {
                    $this->hideMessageButtons($channel, $message['chat']['id'], $message['message_id']);
                }
            } elseif (str_starts_with($callbackData, 'action_')) {
                // Legacy format (for backwards compatibility)
                Log::info('Processing legacy button action', ['callback_data' => $callbackData]);
                $encodedData = str_replace('action_', '', $callbackData);
                try {
                    $actionData = json_decode(base64_decode($encodedData), true);
                    if ($actionData && isset($actionData['action'])) {
                        $this->executeButtonAction($chat, $actionData['action'], $actionData['config'] ?? [], $channel);
                        // Answer callback query after successful execution
                        $this->answerCallbackQuery($channel, $callbackQuery['id']);
                    } else {
                        Log::warning('Invalid action data', ['action_data' => $actionData]);
                        $this->answerCallbackQuery($channel, $callbackQuery['id'], 'Ошибка: неверные данные кнопки');
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to decode button action', [
                        'error' => $e->getMessage(),
                        'callback_data' => $callbackData,
                    ]);
                    $this->answerCallbackQuery($channel, $callbackQuery['id'], 'Ошибка обработки кнопки');
                }
            } else {
                Log::warning('Unknown callback_data format', ['callback_data' => $callbackData]);
                $this->answerCallbackQuery($channel, $callbackQuery['id']);
            }
        } catch (\Exception $e) {
            Log::error('Error processing callback query', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'callback_data' => $callbackData,
            ]);
            // Always answer callback query, even on error
            $this->answerCallbackQuery($channel, $callbackQuery['id'], 'Произошла ошибка');
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
     * Execute button action from callback data (format: step_id:button_index)
     */
    protected function executeButtonActionFromCallback(Chat $chat, string $callbackData, Channel $channel, array $callbackQuery = []): bool
    {
        Log::info('Executing button action from callback', [
            'chat_id' => $chat->id,
            'callback_data' => $callbackData,
        ]);
        
        // Parse callback_data: step_id:button_index or b{hash}_{index}
        $stepId = '';
        $buttonIndex = -1;
        $parts = [];
        
        if (str_contains($callbackData, ':')) {
            $parts = explode(':', $callbackData, 2);
            $stepId = $parts[0] ?? '';
            $buttonIndex = isset($parts[1]) ? (int)$parts[1] : -1;
            
            // Check if this is a step inside a group (format: step-{id}-s{index} or group-{id}-s{index}:button_index)
            // Pattern: anything ending with -s followed by a number
            if (!empty($stepId) && preg_match('/-s\d+$/', $stepId)) {
                // Extract group step_id and step index
                // Format: {group_step_id}-s{step_index}
                // e.g., "step-1765537993445-s1" means group step_id is "step-1765537993445", step index is 1
                $groupParts = explode('-s', $stepId, 2);
                $groupStepId = $groupParts[0] ?? '';
                $groupStepIndex = isset($groupParts[1]) ? (int)$groupParts[1] : -1;
                
                Log::info('Parsing group step callback', [
                    'original_step_id' => $stepId,
                    'group_step_id' => $groupStepId,
                    'group_step_index' => $groupStepIndex,
                    'button_index' => $buttonIndex,
                ]);
                
                // Find the group step - try to find by step_id
                $groupStep = \App\Models\AutomationStep::where('step_id', $groupStepId)
                    ->where('type', 'group')
                    ->first();
                
                // If not found by step_id, try to find by ID if groupStepId starts with "step-"
                if (!$groupStep && str_starts_with($groupStepId, 'step-')) {
                    $possibleId = str_replace('step-', '', $groupStepId);
                    if (is_numeric($possibleId)) {
                        $groupStep = \App\Models\AutomationStep::where('id', (int)$possibleId)
                            ->where('type', 'group')
                            ->first();
                        if ($groupStep) {
                            Log::info('Found group step by ID instead of step_id', [
                                'id' => $groupStep->id,
                                'step_id' => $groupStep->step_id,
                            ]);
                        }
                    }
                }
                
                if ($groupStep && $groupStepIndex >= 0) {
                    $groupConfig = $groupStep->config ?? [];
                    $groupSteps = $groupConfig['steps'] ?? [];
                    
                    if (isset($groupSteps[$groupStepIndex])) {
                        $targetStepConfig = $groupSteps[$groupStepIndex];
                        $buttons = $targetStepConfig['config']['buttons'] ?? [];
                        
                        if (isset($buttons[$buttonIndex])) {
                            $button = $buttons[$buttonIndex];
                            
                            // Check if button has URL (URL buttons should not hide)
                            if (!empty($button['url'])) {
                                Log::info('Button from group step has URL, will not hide buttons', ['url' => $button['url']]);
                                return true; // Return true to indicate URL button
                            }
                            
                            if (!empty($button['action']) && !empty($button['action_config'])) {
                                Log::info('Executing button action from group step', [
                                    'action' => $button['action'],
                                    'action_config' => $button['action_config'],
                                ]);
                                $this->executeButtonAction($chat, $button['action'], $button['action_config'], $channel);
                                // Non-URL buttons should hide
                                return false;
                            }
                            
                            // Button has no action or URL
                            return false;
                        }
                    }
                }
                
                Log::warning('Could not find group step or button', [
                    'group_step_id' => $groupStepId,
                    'group_step_index' => $groupStepIndex,
                    'button_index' => $buttonIndex,
                ]);
                return false;
            }
            
            Log::info('Parsed callback_data', ['step_id' => $stepId, 'button_index' => $buttonIndex]);
        } elseif (str_starts_with($callbackData, 'b') && str_contains($callbackData, '_')) {
            // Hash format - need to find step by matching hash
            $hashPart = substr($callbackData, 1, strpos($callbackData, '_') - 1);
            $buttonIndex = (int)substr($callbackData, strpos($callbackData, '_') + 1);
            // Find step by searching all automation steps (less efficient, but fallback)
            // For SQLite compatibility, we'll search differently
            $automationSteps = \App\Models\AutomationStep::where('type', 'send_text_with_buttons')
                ->get()
                ->filter(function($step) {
                    $config = $step->config ?? [];
                    return !empty($config['buttons']);
                });
            
            foreach ($automationSteps as $step) {
                $buttons = $step->config['buttons'] ?? [];
                foreach ($buttons as $idx => $button) {
                    $testHash = substr(md5($step->step_id . '_' . $idx), 0, 16);
                    if ($testHash === $hashPart && $idx === $buttonIndex) {
                        $stepId = $step->step_id;
                        break 2;
                    }
                }
            }
            
            if (empty($stepId)) {
                Log::warning('Could not find step by hash', ['callback_data' => $callbackData]);
                return false;
            }
        } else {
            Log::warning('Invalid callback_data format', ['callback_data' => $callbackData]);
            return false;
        }
        
        if (empty($stepId) || $buttonIndex < 0) {
            Log::warning('Invalid callback_data format', ['callback_data' => $callbackData, 'step_id' => $stepId, 'button_index' => $buttonIndex]);
            return false;
        }
        
        // Find the step
        $step = \App\Models\AutomationStep::where('step_id', $stepId)->first();
        if (!$step) {
            Log::warning('Step not found', ['step_id' => $stepId]);
            return false;
        }
        
        // Get button config from step
        $buttons = $step->config['buttons'] ?? [];
        Log::info('Step buttons', ['step_id' => $stepId, 'buttons_count' => count($buttons), 'button_index' => $buttonIndex]);
        
        if (!isset($buttons[$buttonIndex])) {
            Log::warning('Button not found', [
                'step_id' => $stepId, 
                'button_index' => $buttonIndex,
                'available_indices' => array_keys($buttons),
            ]);
            return false;
        }
        
        $button = $buttons[$buttonIndex];
        Log::info('Button config', ['button' => $button]);
        
        // Check if button has URL (URL buttons should not hide and are handled by Telegram directly)
        if (!empty($button['url'])) {
            Log::info('Button has URL, will not hide buttons (URL buttons are handled by Telegram)', ['url' => $button['url']]);
            return true; // Return true to indicate URL button
        }
        
        if (empty($button['action']) || empty($button['action_config'])) {
            Log::warning('Button has no action', ['button' => $button]);
            return false;
        }
        
        // Execute the action
        Log::info('Executing button action', [
            'action' => $button['action'],
            'action_config' => $button['action_config'],
        ]);
        $this->executeButtonAction($chat, $button['action'], $button['action_config'], $channel);
        Log::info('Button action executed successfully');
        
        // Return false to indicate that buttons should be hidden (non-URL button)
        return false;
    }

    /**
     * Execute button action
     */
    protected function executeButtonAction(Chat $chat, string $action, array $config, Channel $channel): void
    {
        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            Log::warning('No telegram_chat_id in chat metadata', ['chat_id' => $chat->id]);
            return;
        }

        switch ($action) {
            case 'send_photo':
                $url = $config['url'] ?? '';
                if ($url) {
                    Log::info('Sending photo from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    $result = $this->sendPhoto($channel, $telegramChatId, $url, '');
                    if (!$result) {
                        Log::warning('Failed to send photo from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('send_photo action called without URL', ['config' => $config]);
                }
                break;

            case 'send_video':
                $url = $config['url'] ?? '';
                if ($url) {
                    Log::info('Sending video from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    $result = $this->sendVideo($channel, $telegramChatId, $url, '');
                    if (!$result) {
                        Log::warning('Failed to send video from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('send_video action called without URL', ['config' => $config]);
                }
                break;

            case 'send_file':
                $url = $config['url'] ?? '';
                if ($url) {
                    Log::info('Sending file from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    $result = $this->sendDocument($channel, $telegramChatId, $url, '');
                    if (!$result) {
                        Log::warning('Failed to send file from button action', ['url' => $url, 'chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('send_file action called without URL', ['config' => $config]);
                }
                break;

            case 'send_text':
                $text = $config['text'] ?? '';
                if ($text) {
                    Log::info('Sending text from button action', ['text_length' => strlen($text), 'chat_id' => $chat->id]);
                    $result = $this->sendMessage($channel, $telegramChatId, $text);
                    if (!$result) {
                        Log::warning('Failed to send text from button action', ['chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('send_text action called without text', ['config' => $config]);
                }
                break;

            case 'add_tag':
                $tagIds = $config['tag_ids'] ?? [];
                Log::info('add_tag action called', [
                    'chat_id' => $chat->id,
                    'config' => $config,
                    'tag_ids' => $tagIds,
                    'tag_ids_type' => gettype($tagIds),
                    'tag_ids_is_array' => is_array($tagIds),
                ]);
                
                if (!empty($tagIds) && is_array($tagIds)) {
                    // Ensure all tag IDs are integers
                    $tagIds = array_map('intval', $tagIds);
                    $tagIds = array_filter($tagIds, fn($id) => $id > 0);
                    
                    $client = $chat->client;
                    if ($client) {
                        $client->tags()->syncWithoutDetaching($tagIds);
                        Log::info('Tags added to client from button', [
                            'client_id' => $client->id,
                            'tag_ids' => $tagIds,
                        ]);
                        
                        // Trigger tag_added automations
                        $automationService = app(AutomationService::class);
                        $automationService->triggerTagAdded($chat, $tagIds);
                    } else {
                        Log::warning('No client found for chat when adding tags', ['chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('Empty or invalid tag_ids in add_tag action', [
                        'tag_ids' => $tagIds,
                        'config' => $config,
                    ]);
                }
                break;

            case 'remove_tag':
                $tagIds = $config['tag_ids'] ?? [];
                Log::info('remove_tag action called', [
                    'chat_id' => $chat->id,
                    'config' => $config,
                    'tag_ids' => $tagIds,
                ]);
                
                if (!empty($tagIds) && is_array($tagIds)) {
                    // Ensure all tag IDs are integers
                    $tagIds = array_map('intval', $tagIds);
                    $tagIds = array_filter($tagIds, fn($id) => $id > 0);
                    
                    $client = $chat->client;
                    if ($client) {
                        $client->tags()->detach($tagIds);
                        Log::info('Tags removed from client from button', [
                            'client_id' => $client->id,
                            'tag_ids' => $tagIds,
                        ]);
                        
                        // Trigger tag_removed automations
                        $automationService = app(AutomationService::class);
                        $automationService->triggerTagRemoved($chat, $tagIds);
                    } else {
                        Log::warning('No client found for chat when removing tags', ['chat_id' => $chat->id]);
                    }
                } else {
                    Log::warning('Empty or invalid tag_ids in remove_tag action', [
                        'tag_ids' => $tagIds,
                        'config' => $config,
                    ]);
                }
                break;

            default:
                Log::warning('Unknown button action', ['action' => $action]);
        }

        Log::info('Button action executed', [
            'action' => $action,
            'chat_id' => $chat->id,
        ]);
    }

    /**
     * Hide inline buttons from message
     */
    protected function hideMessageButtons(Channel $channel, int $chatId, int $messageId): void
    {
        $credentials = $channel->credentials ?? [];
        $botToken = $credentials['bot_token'] ?? null;

        if (!$botToken) {
            return;
        }

        try {
            $params = [
                'chat_id' => $chatId,
                'message_id' => $messageId,
                'reply_markup' => json_encode(['inline_keyboard' => []]),
            ];

            $response = Http::post("https://api.telegram.org/bot{$botToken}/editMessageReplyMarkup", $params);
            
            if ($response->successful()) {
                Log::info('Message buttons hidden successfully', [
                    'channel_id' => $channel->id,
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                ]);
            } else {
                Log::warning('Failed to hide message buttons', [
                    'channel_id' => $channel->id,
                    'chat_id' => $chatId,
                    'message_id' => $messageId,
                    'response' => $response->body(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Telegram hideMessageButtons error', [
                'channel_id' => $channel->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
