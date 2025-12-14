<?php

namespace App\Services;

use App\Models\Automation;
use App\Models\AutomationLog;
use App\Models\AutomationStep;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\Tag;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class AutomationService
{
    protected TelegramService $telegramService;
    
    // Flag to prevent recursive tag triggers during automation execution
    protected static bool $isExecutingTagAutomation = false;

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
     * Trigger automation on incoming message
     */
    public function triggerIncomingMessage(Chat $chat, Message $message): void
    {
        $automations = Automation::where('is_active', true)
            ->where('trigger', 'incoming_message')
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
     * Trigger automation when tag is added to client
     */
    public function triggerTagAdded(Chat $chat, array $tagIds): void
    {
        if (empty($tagIds)) {
            return;
        }

        Log::info('triggerTagAdded called', [
            'chat_id' => $chat->id,
            'chat_channel_id' => $chat->channel_id,
            'tag_ids' => $tagIds,
        ]);

        // Prevent recursive triggers when automation adds tags
        if (self::$isExecutingTagAutomation) {
            Log::info('Skipping tag_added trigger - already executing tag automation', [
                'chat_id' => $chat->id,
                'tag_ids' => $tagIds,
            ]);
            return;
        }

        $automations = Automation::where('is_active', true)
            ->where('trigger', 'tag_added')
            ->where(function ($query) use ($chat) {
                $query->whereNull('channel_id')
                    ->orWhere('channel_id', $chat->channel_id);
            })
            ->with('steps')
            ->get();

        Log::info('Found tag_added automations', [
            'count' => $automations->count(),
            'automations' => $automations->map(fn($a) => [
                'id' => $a->id,
                'name' => $a->name,
                'channel_id' => $a->channel_id,
                'trigger_config' => $a->trigger_config,
            ])->toArray(),
        ]);

        foreach ($automations as $automation) {
            $config = $automation->trigger_config ?? [];
            $triggerTagId = $config['tag_id'] ?? null;

            Log::info('Checking automation', [
                'automation_id' => $automation->id,
                'automation_name' => $automation->name,
                'trigger_tag_id' => $triggerTagId,
                'added_tag_ids' => $tagIds,
                'tag_match' => $triggerTagId ? in_array((int)$triggerTagId, array_map('intval', $tagIds)) : 'any',
            ]);

            // Deduplication: prevent same automation from running twice for same chat+tag in short time
            $cacheKey = "tag_automation_{$automation->id}_{$chat->id}_" . implode('_', $tagIds);
            if (Cache::has($cacheKey)) {
                Log::info('Skipping duplicate tag_added automation', [
                    'automation_id' => $automation->id,
                    'chat_id' => $chat->id,
                ]);
                continue;
            }
            Cache::put($cacheKey, true, now()->addSeconds(30));

            // If automation has specific tag_id, check if it matches
            if ($triggerTagId) {
                if (in_array((int)$triggerTagId, array_map('intval', $tagIds))) {
                    Log::info('Triggering tag_added automation', [
                        'automation_id' => $automation->id,
                        'automation_name' => $automation->name,
                        'trigger_tag_id' => $triggerTagId,
                        'added_tag_ids' => $tagIds,
                    ]);
                    
                    self::$isExecutingTagAutomation = true;
                    try {
                        $this->executeAutomation($automation, $chat);
                    } finally {
                        self::$isExecutingTagAutomation = false;
                    }
                } else {
                    Log::info('Tag ID does not match, skipping automation', [
                        'automation_id' => $automation->id,
                        'trigger_tag_id' => $triggerTagId,
                        'added_tag_ids' => $tagIds,
                    ]);
                }
            } else {
                // No specific tag - trigger on any tag added
                Log::info('Triggering tag_added automation (any tag)', [
                    'automation_id' => $automation->id,
                    'automation_name' => $automation->name,
                    'added_tag_ids' => $tagIds,
                ]);
                
                self::$isExecutingTagAutomation = true;
                try {
                    $this->executeAutomation($automation, $chat);
                } finally {
                    self::$isExecutingTagAutomation = false;
                }
            }
        }
    }

    /**
     * Trigger automation when tag is removed from client
     */
    public function triggerTagRemoved(Chat $chat, array $tagIds): void
    {
        if (empty($tagIds)) {
            return;
        }

        // Prevent recursive triggers when automation removes tags
        if (self::$isExecutingTagAutomation) {
            Log::info('Skipping tag_removed trigger - already executing tag automation', [
                'chat_id' => $chat->id,
                'tag_ids' => $tagIds,
            ]);
            return;
        }

        $automations = Automation::where('is_active', true)
            ->where('trigger', 'tag_removed')
            ->where(function ($query) use ($chat) {
                $query->whereNull('channel_id')
                    ->orWhere('channel_id', $chat->channel_id);
            })
            ->with('steps')
            ->get();

        foreach ($automations as $automation) {
            $config = $automation->trigger_config ?? [];
            $triggerTagId = $config['tag_id'] ?? null;

            // Deduplication: prevent same automation from running twice for same chat+tag in short time
            $cacheKey = "tag_rm_automation_{$automation->id}_{$chat->id}_" . implode('_', $tagIds);
            if (Cache::has($cacheKey)) {
                Log::info('Skipping duplicate tag_removed automation', [
                    'automation_id' => $automation->id,
                    'chat_id' => $chat->id,
                ]);
                continue;
            }
            Cache::put($cacheKey, true, now()->addSeconds(30));

            if ($triggerTagId) {
                if (in_array((int)$triggerTagId, array_map('intval', $tagIds))) {
                    Log::info('Triggering tag_removed automation', [
                        'automation_id' => $automation->id,
                        'automation_name' => $automation->name,
                        'trigger_tag_id' => $triggerTagId,
                        'removed_tag_ids' => $tagIds,
                    ]);
                    
                    self::$isExecutingTagAutomation = true;
                    try {
                        $this->executeAutomation($automation, $chat);
                    } finally {
                        self::$isExecutingTagAutomation = false;
                    }
                }
            } else {
                Log::info('Triggering tag_removed automation (any tag)', [
                    'automation_id' => $automation->id,
                    'automation_name' => $automation->name,
                    'removed_tag_ids' => $tagIds,
                ]);
                
                self::$isExecutingTagAutomation = true;
                try {
                    $this->executeAutomation($automation, $chat);
                } finally {
                    self::$isExecutingTagAutomation = false;
                }
            }
        }
    }

    /**
     * Trigger automation when chat is opened by operator
     */
    public function triggerChatOpened(Chat $chat): void
    {
        $automations = Automation::where('is_active', true)
            ->where('trigger', 'chat_opened')
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
     * Trigger automation when chat is closed
     */
    public function triggerChatClosed(Chat $chat): void
    {
        $automations = Automation::where('is_active', true)
            ->where('trigger', 'chat_closed')
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
     * Execute a single step (public method for callback execution)
     */
    public function executeStep(AutomationStep $step, Chat $chat, ?AutomationLog $log = null, ?Message $triggerMessage = null): bool
    {
        $config = $step->config ?? [];

        Log::info('Executing step', [
            'step_id' => $step->id,
            'type' => $step->type,
            'chat_id' => $chat->id,
        ]);

        // Update log with current step (if log exists)
        if ($log) {
            $stepsExecuted = $log->steps_executed ?? [];
            $stepsExecuted[] = [
                'step_id' => $step->step_id,
                'type' => $step->type,
                'started_at' => now()->toIsoString(),
            ];
            $log->update(['steps_executed' => $stepsExecuted]);
        }

        switch ($step->type) {
            case 'group':
                // Execute all steps inside the group
                $groupSteps = $config['steps'] ?? [];
                if (!empty($groupSteps) && is_array($groupSteps)) {
                    Log::info('Executing group steps', [
                        'step_id' => $step->id ?? $step->step_id ?? null,
                        'group_name' => $config['name'] ?? 'Unnamed group',
                        'steps_count' => count($groupSteps),
                    ]);
                    
                    $groupStepId = $step->step_id ?? 'group-' . ($step->id ?? 'unknown');
                    
                    foreach ($groupSteps as $groupStepIndex => $groupStepConfig) {
                        // Create a temporary AutomationStep object for execution
                        $groupStep = new AutomationStep();
                        // For steps inside groups, use group step_id with index as identifier
                        // This ensures callback_data can be properly generated
                        $groupStep->step_id = $groupStepConfig['step_id'] ?? ($groupStepId . '-s' . $groupStepIndex);
                        $groupStep->type = $groupStepConfig['type'] ?? 'send_text';
                        
                        // Store group context in config for callback_data generation
                        $stepConfig = $groupStepConfig['config'] ?? [];
                        $stepConfig['_group_step_id'] = $groupStepId;
                        $stepConfig['_group_step_index'] = $groupStepIndex;
                        $groupStep->config = $stepConfig;
                        
                        $groupStep->automation_id = $step->automation_id;
                        $groupStep->exists = false; // Mark as not persisted
                        
                        // Execute the step inside the group recursively
                        $this->executeStep($groupStep, $chat, $log, $triggerMessage);
                    }
                }
                break;

            case 'send_text':
                $this->executeStepSendText($chat, $config);
                break;

            case 'send_text_with_buttons':
                $this->executeStepSendTextWithButtons($chat, $config, $step);
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
                if ($log) {
                    $this->pauseAutomationForCondition($step, $chat, $log);
                    return false; // Stop current execution
                }
                // If no log (callback execution), just continue
                break;

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
            Log::warning('executeStepSendText: empty text', ['config' => $config]);
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

        Log::info('Sending text message', [
            'chat_id' => $chat->id,
            'telegram_chat_id' => $telegramChatId,
            'text_length' => strlen($text),
        ]);

        // Send via Telegram
        $result = $this->telegramService->sendMessage(
            $chat->channel,
            $telegramChatId,
            $text
        );

        Log::info('Text message send result', [
            'chat_id' => $chat->id,
            'result' => $result ? 'success' : 'failed',
            'message_id' => $result['message_id'] ?? null,
        ]);

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
        } else {
            Log::error('Failed to send text message', ['chat_id' => $chat->id]);
        }
    }

    /**
     * Send text message with inline buttons (optionally with image)
     */
    protected function executeStepSendTextWithButtons(Chat $chat, array $config, AutomationStep $step): void
    {
        $text = $config['text'] ?? '';
        $buttons = $config['buttons'] ?? [];
        $imageUrl = $config['url'] ?? '';
        
        if (empty($text) && empty($imageUrl)) {
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

        // Build inline keyboard from buttons config
        $inlineKeyboard = [];
        if (!empty($buttons)) {
            foreach ($buttons as $buttonIndex => $button) {
                if (empty($button['text'])) {
                    continue; // Skip buttons without text
                }

                $buttonData = ['text' => $button['text']];
                
                // Add URL or callback_data for action buttons
                if (!empty($button['url'])) {
                    $buttonData['url'] = $button['url'];
                } elseif (!empty($button['action'])) {
                    // Use short format: step_id + button_index
                    // Telegram limits callback_data to 64 bytes
                    // step_id format is usually like "step-1234567890" (max ~20 chars)
                    // button_index is 1-2 digits
                    // So format: {step_id}:{button_index} fits well
                    $stepId = $step->step_id ?? '';
                    
                    // If step_id is empty (can happen for steps inside groups), check for group context
                    if (empty($stepId)) {
                        $config = $step->config ?? [];
                        if (isset($config['_group_step_id']) && isset($config['_group_step_index'])) {
                            // Use group step_id with index for steps inside groups
                            // Format: {group_step_id}-s{step_index}
                            $stepId = $config['_group_step_id'] . '-s' . $config['_group_step_index'];
                        } elseif (isset($step->id)) {
                            // Use step ID from database
                            $stepId = 'step-' . $step->id;
                        } else {
                            // Fallback: use a generated ID
                            $stepId = 'step-' . uniqid();
                        }
                    } else {
                        // Step_id is set, but if it's a step inside a group, we need to add the group context
                        $config = $step->config ?? [];
                        if (isset($config['_group_step_id']) && isset($config['_group_step_index'])) {
                            // Override with group format
                            $stepId = $config['_group_step_id'] . '-s' . $config['_group_step_index'];
                        }
                    }
                    
                    $callbackData = $stepId . ':' . $buttonIndex;
                    
                    // If step_id is too long, use a hash
                    if (strlen($callbackData) > 60) {
                        // Use shorter format: hash of step_id + button_index
                        $hash = substr(md5($stepId . '_' . $buttonIndex), 0, 16);
                        $callbackData = 'b' . $hash . '_' . $buttonIndex;
                    }
                    
                    // Ensure it's within 64 bytes
                    if (strlen($callbackData) > 64) {
                        $callbackData = substr($callbackData, 0, 64);
                    }
                    
                    $buttonData['callback_data'] = $callbackData;
                } else {
                    continue; // Skip buttons without action
                }

                // Each button is in its own row (can be changed to group buttons)
                $inlineKeyboard[] = [$buttonData];
            }
        }
        
        Log::info('Inline keyboard built', [
            'chat_id' => $chat->id,
            'buttons_count' => count($buttons),
            'inline_keyboard' => $inlineKeyboard,
        ]);

        $result = null;
        $messageType = 'text';
        $attachments = null;

        // If image is provided, send photo with caption and buttons
        if (!empty($imageUrl)) {
            Log::info('Sending photo with buttons', [
                'chat_id' => $chat->id,
                'image_url' => $imageUrl,
                'has_keyboard' => !empty($inlineKeyboard),
                'keyboard_rows' => count($inlineKeyboard),
            ]);
            
            $result = $this->telegramService->sendPhoto(
                $chat->channel,
                $telegramChatId,
                $imageUrl,
                $text,
                !empty($inlineKeyboard) ? $inlineKeyboard : null
            );
            
            $messageType = 'image';
            $storedUrl = $imageUrl;
            if (!str_starts_with($storedUrl, 'http') && !str_starts_with($storedUrl, '/')) {
                $storedUrl = '/storage/' . ltrim($storedUrl, '/');
            }
            $attachments = [['url' => $storedUrl, 'type' => 'image']];
        } else {
            // Send text message with buttons
            Log::info('Sending text message with buttons', [
                'chat_id' => $chat->id,
                'has_keyboard' => !empty($inlineKeyboard),
                'keyboard_rows' => count($inlineKeyboard),
            ]);
            
            $result = $this->telegramService->sendMessage(
                $chat->channel,
                $telegramChatId,
                $text,
                !empty($inlineKeyboard) ? $inlineKeyboard : null
            );
        }

        Log::info('Text message with buttons send result', [
            'chat_id' => $chat->id,
            'result' => $result ? 'success' : 'failed',
            'message_id' => $result['message_id'] ?? null,
        ]);

        if ($result) {
            // Create outgoing message record
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'operator_id' => null,
                'direction' => 'outgoing',
                'type' => $messageType,
                'content' => $text,
                'status' => 'sent',
                'attachments' => $attachments,
                'metadata' => [
                    'telegram_message_id' => $result['message_id'] ?? null,
                    'sent_by' => 'automation',
                    'inline_buttons' => $buttons,
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
        $client = $chat->client;
        if (!$client) {
            return;
        }

        $tagIds = $config['tag_ids'] ?? [];
        $tagId = $config['tag_id'] ?? null; // Backward compatibility
        $tagName = $config['tag_name'] ?? null; // Backward compatibility

        $tagsToAdd = [];

        // Support multiple tags via tag_ids array
        if (!empty($tagIds) && is_array($tagIds)) {
            foreach ($tagIds as $id) {
                $tag = Tag::find($id);
                if ($tag) {
                    $tagsToAdd[] = $tag;
                }
            }
        }
        // Backward compatibility: single tag via tag_id
        elseif ($tagId) {
            $tag = Tag::find($tagId);
            if ($tag) {
                $tagsToAdd[] = $tag;
            }
        }
        // Backward compatibility: single tag via tag_name
        elseif ($tagName) {
            $tag = Tag::where('name', $tagName)->first();
            if (!$tag) {
                $tag = Tag::create([
                    'name' => $tagName,
                    'color' => '#' . substr(md5($tagName), 0, 6),
                ]);
            }
            if ($tag) {
                $tagsToAdd[] = $tag;
            }
        }

        if (!empty($tagsToAdd)) {
            $tagIdsToAdd = array_map(fn($tag) => $tag->id, $tagsToAdd);
            $client->tags()->syncWithoutDetaching($tagIdsToAdd);
            
            $tagNames = array_map(fn($tag) => $tag->name, $tagsToAdd);
            
            Log::info('Tags added to client', [
                'client_id' => $client->id,
                'tag_ids' => $tagIdsToAdd,
            ]);

            // Создаем системное сообщение о добавлении тегов
            $tagNamesString = implode('", "', $tagNames);
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => 'Система присвоила клиенту теги: "' . $tagNamesString . '".',
                'status' => 'sent',
                'metadata' => [
                    'system_action' => 'tag_added',
                    'tag_ids' => $tagIdsToAdd,
                    'tag_names' => $tagNames,
                    'sent_by' => 'automation',
                ],
            ]);

            // Trigger tag_added automations (for chained automations)
            $this->triggerTagAdded($chat, $tagIdsToAdd);
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

        // Trigger tag_removed automations (for chained automations)
        $this->triggerTagRemoved($chat, [$tag->id]);
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
