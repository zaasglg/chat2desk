<?php

namespace App\Services;

use App\Models\Automation;
use App\Models\AutomationLog;
use App\Models\AutomationStep;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\Tag;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class AutomationService
{
    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }

    /**
     * Trigger automation on new chat
     */
    public function triggerNewChat(Chat $chat): void
    {
        $automations = Automation::where('is_active', true)
            ->where('trigger', 'new_chat')
            ->where(function ($query) use ($chat) {
                $query->whereNull('channel_id')
                    ->orWhere('channel_id', $chat->channel_id);
            })
            ->with('steps')
            ->orderBy('id')
            ->get();

        foreach ($automations as $automation) {
            $this->executeAutomation($automation, $chat);
        }
    }

    /**
     * Trigger automation on keyword match
     */
    public function triggerKeyword(Chat $chat, Message $message): void
    {
        $automations = Automation::where('is_active', true)
            ->where('trigger', 'keyword')
            ->where(function ($query) use ($chat) {
                $query->whereNull('channel_id')
                    ->orWhere('channel_id', $chat->channel_id);
            })
            ->with('steps')
            ->get();

        $messageText = mb_strtolower($message->content ?? '');

        foreach ($automations as $automation) {
            $config = $automation->trigger_config ?? [];
            $keywords = $config['keywords'] ?? '';
            
            if (empty($keywords)) {
                continue;
            }

            // Split keywords by comma and check each
            $keywordList = array_map('trim', explode(',', mb_strtolower($keywords)));
            
            foreach ($keywordList as $keyword) {
                if (!empty($keyword) && str_contains($messageText, $keyword)) {
                    $this->executeAutomation($automation, $chat, $message);
                    break; // Execute once per automation
                }
            }
        }
    }

    /**
     * Execute automation steps
     */
    public function executeAutomation(Automation $automation, Chat $chat, ?Message $triggerMessage = null): void
    {
        Log::info('Executing automation', [
            'automation_id' => $automation->id,
            'automation_name' => $automation->name,
            'chat_id' => $chat->id,
        ]);

        // Create log entry
        $log = AutomationLog::create([
            'automation_id' => $automation->id,
            'chat_id' => $chat->id,
            'client_id' => $chat->client_id,
            'trigger_data' => [
                'message_id' => $triggerMessage?->id,
                'message_content' => $triggerMessage?->content,
            ],
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            // Get steps ordered by position
            $steps = $automation->steps()->orderBy('order')->get();

            foreach ($steps as $step) {
                $shouldContinue = $this->executeStep($step, $chat, $log, $triggerMessage);
                
                // If condition step returns false, stop execution
                if ($step->type === 'condition' && !$shouldContinue) {
                    Log::info('Condition failed, stopping automation', [
                        'automation_id' => $automation->id,
                        'step_id' => $step->id
                    ]);
                    break;
                }
            }

            // Mark as completed
            $log->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            Log::info('Automation completed', [
                'automation_id' => $automation->id,
                'log_id' => $log->id,
            ]);

        } catch (\Exception $e) {
            $log->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            Log::error('Automation failed', [
                'automation_id' => $automation->id,
                'log_id' => $log->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Execute a single step
     */
    protected function executeStep(AutomationStep $step, Chat $chat, AutomationLog $log, ?Message $triggerMessage = null): bool
    {
        $config = $step->config ?? [];

        Log::info('Executing step', [
            'step_id' => $step->id,
            'type' => $step->type,
            'chat_id' => $chat->id,
        ]);

        // Update log with current step
        $stepsExecuted = $log->steps_executed ?? [];
        $stepsExecuted[] = [
            'step_id' => $step->step_id,
            'type' => $step->type,
            'started_at' => now()->toIsoString(),
        ];
        $log->update(['steps_executed' => $stepsExecuted]);

        switch ($step->type) {
            case 'send_text':
                $this->executeStepSendText($chat, $config);
                break;

            case 'send_image':
                $this->executeStepSendImage($chat, $config);
                break;

            case 'send_video':
                $this->executeStepSendVideo($chat, $config);
                break;

            case 'send_file':
                $this->executeStepSendFile($chat, $config);
                break;

            case 'delay':
                $this->executeStepDelay($config);
                break;

            case 'add_tag':
                $this->executeStepAddTag($chat, $config);
                break;

            case 'remove_tag':
                $this->executeStepRemoveTag($chat, $config);
                break;

            case 'assign_operator':
                $this->executeStepAssignOperator($chat, $config);
                break;

            case 'close_chat':
                $this->executeStepCloseChat($chat);
                break;

            case 'condition':
                // For conditions, we need to pause automation and wait for next message
                $this->pauseAutomationForCondition($step, $chat, $log);
                return false; // Stop current execution

            default:
                Log::warning('Unknown step type', ['type' => $step->type]);
        }
        
        return true;
    }

    /**
     * Send text message
     */
    protected function executeStepSendText(Chat $chat, array $config): void
    {
        $text = $config['text'] ?? '';
        if (empty($text)) {
            return;
        }

        // Replace variables
        $text = $this->replaceVariables($text, $chat);

        // Get telegram chat ID from metadata
        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            Log::warning('No telegram_chat_id in chat metadata', ['chat_id' => $chat->id]);
            return;
        }

        // Send via Telegram
        $result = $this->telegramService->sendMessage(
            $chat->channel,
            $telegramChatId,
            $text
        );

        if ($result) {
            // Create outgoing message record
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'operator_id' => null,
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => $text,
                'status' => 'sent',
                'metadata' => [
                    'telegram_message_id' => $result['message_id'] ?? null,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Send image
     */
    protected function executeStepSendImage(Chat $chat, array $config): void
    {
        Log::info('executeStepSendImage called with config: ' . json_encode($config));
        
        $url = $config['url'] ?? '';
        $caption = $config['text'] ?? '';

        if (empty($url)) {
            Log::warning('No URL provided for send_image step. Config: ' . json_encode($config));
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            Log::warning('No telegram_chat_id in metadata', ['chat_id' => $chat->id]);
            return;
        }

        // Keep relative path for TelegramService to handle local files
        $originalUrl = $url;
        
        Log::info('Sending photo to Telegram', [
            'url' => $url,
            'telegram_chat_id' => $telegramChatId,
            'caption' => $caption
        ]);

        // Send photo via Telegram
        $result = $this->telegramService->sendPhoto(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );

        if ($result) {
            // Normalize stored URL: if it's a relative storage path, prefix with /storage
            $storedUrl = $originalUrl;
            if (!str_starts_with($storedUrl, 'http') && !str_starts_with($storedUrl, '/')) {
                $storedUrl = '/storage/' . ltrim($storedUrl, '/');
            }

            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'image',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $storedUrl, 'type' => 'image']],
                'metadata' => [
                    'telegram_message_id' => $result['message_id'] ?? null,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Send video
     */
    protected function executeStepSendVideo(Chat $chat, array $config): void
    {
        Log::info('executeStepSendVideo called with config: ' . json_encode($config));
        
        $url = $config['url'] ?? '';
        $caption = $config['text'] ?? '';

        if (empty($url)) {
            Log::warning('No URL provided for send_video step. Config: ' . json_encode($config));
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            Log::warning('No telegram_chat_id in metadata', ['chat_id' => $chat->id]);
            return;
        }

        // Keep relative path for TelegramService to handle local files
        $originalUrl = $url;
        
        Log::info('Sending video to Telegram', [
            'url' => $url,
            'telegram_chat_id' => $telegramChatId,
            'caption' => $caption
        ]);

        $result = $this->telegramService->sendVideo(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );

        if ($result) {
            $storedUrl = $originalUrl;
            if (!str_starts_with($storedUrl, 'http') && !str_starts_with($storedUrl, '/')) {
                $storedUrl = '/storage/' . ltrim($storedUrl, '/');
            }

            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'video',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $storedUrl, 'type' => 'video']],
                'metadata' => [
                    'telegram_message_id' => $result['message_id'] ?? null,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Send file
     */
    protected function executeStepSendFile(Chat $chat, array $config): void
    {
        $url = $config['url'] ?? '';
        $caption = $config['text'] ?? '';

        if (empty($url)) {
            Log::warning('No URL provided for send_file step', ['config' => $config]);
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            return;
        }

        // Keep relative path for TelegramService to handle local files
        $originalUrl = $url;

        $result = $this->telegramService->sendDocument(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );
        if ($result) {
            $storedUrl = $originalUrl;
            if (!str_starts_with($storedUrl, 'http') && !str_starts_with($storedUrl, '/')) {
                $storedUrl = '/storage/' . ltrim($storedUrl, '/');
            }

            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'file',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $storedUrl, 'type' => 'file']],
                'metadata' => [
                    'telegram_message_id' => $result['message_id'] ?? null,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Execute delay step
     */
    protected function executeStepDelay(array $config): void
    {
        $seconds = (int) ($config['delay_seconds'] ?? 0);
        if ($seconds > 0 && $seconds <= 300) { // Max 5 minutes delay
            sleep($seconds);
        }
    }

    /**
     * Add tag to client
     */
    protected function executeStepAddTag(Chat $chat, array $config): void
    {
        $tagId = $config['tag_id'] ?? null;
        $tagName = $config['tag_name'] ?? null;

        $client = $chat->client;
        if (!$client) {
            return;
        }

        // Find tag by ID or name
        $tag = null;
        if ($tagId) {
            $tag = Tag::find($tagId);
        } elseif ($tagName) {
            $tag = Tag::where('name', $tagName)->first();
            // Create tag if not exists
            if (!$tag) {
                $tag = Tag::create([
                    'name' => $tagName,
                    'color' => '#' . substr(md5($tagName), 0, 6),
                ]);
            }
        }

        if ($tag) {
            $client->tags()->syncWithoutDetaching([$tag->id]);
            Log::info('Tag added to client', [
                'client_id' => $client->id,
                'tag_id' => $tag->id,
            ]);

            // Создаем системное сообщение о добавлении тега
            // Store as an outgoing text message but mark in metadata as a system action
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => 'Система присвоила клиенту теги: "' . $tag->name . '".',
                'status' => 'sent',
                'metadata' => [
                    'system_action' => 'tag_added',
                    'tag_id' => $tag->id,
                    'tag_name' => $tag->name,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Remove tag from client
     */
    protected function executeStepRemoveTag(Chat $chat, array $config): void
    {
        $tagId = $config['tag_id'] ?? null;
        $tagName = $config['tag_name'] ?? null;

        $client = $chat->client;
        if (!$client) {
            Log::warning('executeStepRemoveTag: no client on chat', ['chat_id' => $chat->id]);
            return;
        }

        // Normalize tag id
        $tag = null;
        if (!empty($tagId)) {
            $tag = Tag::find((int) $tagId);
        }

        if (!$tag && !empty($tagName)) {
            $tag = Tag::where('name', $tagName)->first();
        }

        if (!$tag) {
            Log::info('executeStepRemoveTag: tag not found', ['tag_id' => $tagId, 'tag_name' => $tagName, 'client_id' => $client->id]);
            return;
        }

        $client->tags()->detach($tag->id);
        Log::info('Tag removed from client', [
            'client_id' => $client->id,
            'tag_id' => $tag->id,
            'tag_name' => $tag->name,
        ]);

        // Создаем системное сообщение об удалении тега (как outgoing text с метаданными)
        Message::create([
            'chat_id' => $chat->id,
            'channel_id' => $chat->channel_id,
            'direction' => 'outgoing',
            'type' => 'text',
            'content' => 'Система удалила тег клиента: "' . $tag->name . '".',
            'status' => 'sent',
            'metadata' => [
                'system_action' => 'tag_removed',
                'tag_id' => $tag->id,
                'tag_name' => $tag->name,
                'sent_by' => 'automation',
            ],
        ]);
    }

    /**
     * Assign operator to chat
     */
    protected function executeStepAssignOperator(Chat $chat, array $config): void
    {
        $operatorId = $config['operator_id'] ?? null;

        if ($operatorId) {
            // Получаем имя оператора
            $operator = \App\Models\User::find($operatorId);
            $operatorName = $operator ? $operator->name : "ID: {$operatorId}";

            $chat->update([
                'operator_id' => $operatorId,
                'status' => 'open',
            ]);
            Log::info('Operator assigned to chat', [
                'chat_id' => $chat->id,
                'operator_id' => $operatorId,
            ]);

            // Создаем системное сообщение о назначении оператора (outgoing text + metadata)
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => "Чат назначен на {$operatorName}. Причина — API/скрипт.",
                'status' => 'sent',
                'metadata' => [
                    'system_action' => 'operator_assigned',
                    'operator_id' => $operatorId,
                    'operator_name' => $operatorName,
                    'sent_by' => 'automation',
                ],
            ]);
        }
    }

    /**
     * Close chat
     */
    protected function executeStepCloseChat(Chat $chat): void
    {
        $chat->update(['status' => 'closed']);
        Log::info('Chat closed by automation', ['chat_id' => $chat->id]);
    }

    /**
     * Execute condition step
     */
    protected function executeStepCondition(AutomationStep $step, Chat $chat, AutomationLog $log, ?Message $triggerMessage = null): bool
    {
        $config = $step->config ?? [];
        $conditionType = $config['condition_type'] ?? '';
        $conditionValue = $config['condition_value'] ?? '';

        Log::info('Executing condition', [
            'type' => $conditionType,
            'value' => $conditionValue,
            'chat_id' => $chat->id
        ]);

        $result = false;

        switch ($conditionType) {
            case 'has_tag':
                $result = $this->checkHasTag($chat, $conditionValue);
                break;

            case 'message_contains':
                $result = $this->checkMessageContains($chat, $conditionValue, $triggerMessage);
                break;

                
            case 'any_message':
                // Any incoming message satisfies this condition
                $result = true;
                break;

            case 'is_new_client':
                $result = $this->checkIsNewClient($chat);
                break;
        }

        Log::info('Condition result', [
            'type' => $conditionType,
            'result' => $result ? 'true' : 'false'
        ]);

        return $result;
    }

    /**
     * Check if client has specific tag
     */
    protected function checkHasTag(Chat $chat, string $tagId): bool
    {
        if (empty($tagId) || !$chat->client) {
            Log::info('checkHasTag: empty tagId or no client', [
                'tag_id' => $tagId,
                'has_client' => $chat->client ? 'yes' : 'no'
            ]);
            return false;
        }

        $hasTag = $chat->client->tags()->where('tags.id', $tagId)->exists();
        
        // Get client tags for logging
        $clientTags = $chat->client->tags()->pluck('tags.id')->toArray();
        
        Log::info('checkHasTag result', [
            'client_id' => $chat->client->id,
            'tag_id' => $tagId,
            'has_tag' => $hasTag,
            'client_tags' => $clientTags
        ]);

        return $hasTag;
    }

    /**
     * Check if message contains text
     */
    protected function checkMessageContains(Chat $chat, string $text, ?Message $triggerMessage = null): bool
    {
        if (empty($text)) {
            Log::warning('Empty text for message_contains condition');
            return false;
        }

        // Always get the last incoming message, not the trigger message
        $message = $chat->messages()->where('direction', 'incoming')->latest()->first();
        if (!$message) {
            Log::info('No message found for message_contains condition');
            return false;
        }

        $messageContent = mb_strtolower($message->content ?? '');
        $searchText = mb_strtolower($text);
        $result = str_contains($messageContent, $searchText);
        
        Log::info('Message contains check', [
            'message_id' => $message->id,
            'message_content' => $messageContent,
            'search_text' => $searchText,
            'result' => $result
        ]);

        return $result;
    }

    /**
     * Check if client is new (first chat)
     */
    protected function checkIsNewClient(Chat $chat): bool
    {
        if (!$chat->client) {
            return false;
        }

        return $chat->client->chats()->count() === 1;
    }

    /**
     * Pause automation for condition and save state
     */
    protected function pauseAutomationForCondition(AutomationStep $step, Chat $chat, AutomationLog $log): void
    {
        // Save automation state to resume later
        $chat->update([
            'metadata' => array_merge($chat->metadata ?? [], [
                'paused_automation' => [
                    'automation_id' => $step->automation_id,
                    'step_id' => $step->id,
                    'log_id' => $log->id,
                    'condition_config' => $step->config
                ]
            ])
        ]);
        
        Log::info('Automation paused for condition', [
            'chat_id' => $chat->id,
            'step_id' => $step->id
        ]);
    }

    /**
     * Check and resume paused automation on new message
     */
    public function checkPausedAutomation(Chat $chat, Message $newMessage): void
    {
        $metadata = $chat->metadata ?? [];
        $pausedAutomation = $metadata['paused_automation'] ?? null;
        
        if (!$pausedAutomation) {
            return;
        }
        
        $conditionConfig = $pausedAutomation['condition_config'] ?? [];
        $conditionType = $conditionConfig['condition_type'] ?? '';
        $conditionValue = $conditionConfig['condition_value'] ?? '';
        
        Log::info('Checking paused automation condition', [
            'chat_id' => $chat->id,
            'condition_type' => $conditionType,
            'condition_value' => $conditionValue,
            'message_content' => $newMessage->content
        ]);
        
        $conditionMet = false;

        switch ($conditionType) {
            case 'message_contains':
                if (!empty($conditionValue)) {
                    $messageContent = mb_strtolower($newMessage->content ?? '');
                    $searchText = mb_strtolower($conditionValue);
                    $conditionMet = str_contains($messageContent, $searchText);
                }
                break;
                
            case 'has_tag':
                // Refresh chat with client and tags
                $chat->load('client.tags');
                $conditionMet = $this->checkHasTag($chat, $conditionValue);
                break;

            case 'any_message':
                // Any new incoming message satisfies this condition
                $conditionMet = true;
                break;
                
            case 'is_new_client':
                $conditionMet = $this->checkIsNewClient($chat);
                break;
        }
        
        Log::info('Paused condition result', [
            'condition_met' => $conditionMet
        ]);
        
        if ($conditionMet) {
            // Resume automation from next step
            $this->resumeAutomation($chat, $pausedAutomation);
        }
        
        // Clear paused state regardless of result
        $newMetadata = $metadata;
        unset($newMetadata['paused_automation']);
        $chat->update(['metadata' => $newMetadata]);
    }
    
    /**
     * Resume automation from paused state
     */
    protected function resumeAutomation(Chat $chat, array $pausedAutomation): void
    {
        $automationId = $pausedAutomation['automation_id'];
        $currentStepId = $pausedAutomation['step_id'];
        
        $automation = Automation::find($automationId);
        if (!$automation) {
            return;
        }
        
        // Get remaining steps after the condition
        $steps = $automation->steps()
            ->where('order', '>', function($query) use ($currentStepId) {
                $query->select('order')
                    ->from('automation_steps')
                    ->where('id', $currentStepId)
                    ->limit(1);
            })
            ->orderBy('order')
            ->get();
            
        Log::info('Resuming automation', [
            'automation_id' => $automationId,
            'remaining_steps' => $steps->count()
        ]);
        
        // Create new log entry for resumed execution
        $log = AutomationLog::create([
            'automation_id' => $automation->id,
            'chat_id' => $chat->id,
            'client_id' => $chat->client_id,
            'trigger_data' => ['resumed_from_condition' => true],
            'status' => 'running',
            'started_at' => now(),
        ]);
        
        // Execute remaining steps
        foreach ($steps as $step) {
            $shouldContinue = $this->executeStep($step, $chat, $log);
            
            if ($step->type === 'condition' && !$shouldContinue) {
                break;
            }
        }
        
        $log->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    /**
     * Replace variables in text
     */
    protected function replaceVariables(string $text, Chat $chat): string
    {
        $client = $chat->client;

        $variables = [
            '{client_name}' => $client?->name ?? 'Клиент',
            '{client_first_name}' => explode(' ', $client?->name ?? 'Клиент')[0],
            '{client_phone}' => $client?->phone ?? '',
            '{client_email}' => $client?->email ?? '',
            '{chat_id}' => $chat->id,
            '{channel_name}' => $chat->channel?->name ?? '',
        ];

        return str_replace(array_keys($variables), array_values($variables), $text);
    }
}
