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
                $this->executeStep($step, $chat, $log);
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
    protected function executeStep(AutomationStep $step, Chat $chat, AutomationLog $log): void
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
                // Conditions are handled differently - skip for now
                break;

            default:
                Log::warning('Unknown step type', ['type' => $step->type]);
        }
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
        $url = $config['url'] ?? '';
        $caption = $config['text'] ?? '';

        if (empty($url)) {
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            return;
        }

        // Send photo via Telegram
        $result = $this->telegramService->sendPhoto(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );

        if ($result) {
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'image',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $url, 'type' => 'image']],
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
        $url = $config['url'] ?? '';
        $caption = $config['text'] ?? '';

        if (empty($url)) {
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            return;
        }

        $result = $this->telegramService->sendVideo(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );

        if ($result) {
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'video',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $url, 'type' => 'video']],
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
            return;
        }

        $telegramChatId = $chat->metadata['telegram_chat_id'] ?? null;
        if (!$telegramChatId) {
            return;
        }

        $result = $this->telegramService->sendDocument(
            $chat->channel,
            $telegramChatId,
            $url,
            $this->replaceVariables($caption, $chat)
        );

        if ($result) {
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'direction' => 'outgoing',
                'type' => 'file',
                'content' => $caption,
                'status' => 'sent',
                'attachments' => [['url' => $url, 'type' => 'file']],
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
        }
    }

    /**
     * Remove tag from client
     */
    protected function executeStepRemoveTag(Chat $chat, array $config): void
    {
        $tagId = $config['tag_id'] ?? null;

        $client = $chat->client;
        if (!$client || !$tagId) {
            return;
        }

        $client->tags()->detach($tagId);
        Log::info('Tag removed from client', [
            'client_id' => $client->id,
            'tag_id' => $tagId,
        ]);
    }

    /**
     * Assign operator to chat
     */
    protected function executeStepAssignOperator(Chat $chat, array $config): void
    {
        $operatorId = $config['operator_id'] ?? null;

        if ($operatorId) {
            $chat->update([
                'operator_id' => $operatorId,
                'status' => 'open',
            ]);
            Log::info('Operator assigned to chat', [
                'chat_id' => $chat->id,
                'operator_id' => $operatorId,
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
