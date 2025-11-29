<?php

namespace App\Console\Commands;

use App\Models\Channel;
use App\Services\TelegramService;
use Illuminate\Console\Command;

class TelegramPollCommand extends Command
{
    protected $signature = 'telegram:poll {--channel= : Channel ID to poll (optional, polls all if not specified)}';

    protected $description = 'Poll Telegram for new messages using long polling';

    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        parent::__construct();
        $this->telegramService = $telegramService;
    }

    public function handle(): int
    {
        $channelId = $this->option('channel');

        // Get channels to poll
        $query = Channel::where('type', 'telegram')->where('is_active', true);
        
        if ($channelId) {
            $query->where('id', $channelId);
        }

        $channels = $query->get();

        if ($channels->isEmpty()) {
            $this->error('No active Telegram channels found.');
            return 1;
        }

        $this->info('Starting Telegram long polling...');
        $this->info('Channels: ' . $channels->pluck('name')->join(', '));
        $this->info('Press Ctrl+C to stop.');
        $this->newLine();

        // Delete webhooks first (required for long polling)
        foreach ($channels as $channel) {
            $this->line("Deleting webhook for {$channel->name}...");
            $this->telegramService->deleteWebhook($channel);
        }

        $this->newLine();

        // Store offsets for each channel
        $offsets = [];
        foreach ($channels as $channel) {
            $offsets[$channel->id] = 0;
        }

        // Main polling loop
        while (true) {
            foreach ($channels as $channel) {
                $updates = $this->telegramService->getUpdates(
                    $channel,
                    $offsets[$channel->id],
                    30
                );

                foreach ($updates as $update) {
                    // Update offset
                    $offsets[$channel->id] = $update['update_id'] + 1;

                    // Process update
                    $this->telegramService->processUpdate($channel, $update);

                    // Log to console
                    $from = $update['message']['from']['first_name'] ?? 'Unknown';
                    $text = $update['message']['text'] ?? '[media]';
                    $this->line("<info>[{$channel->name}]</info> {$from}: " . mb_substr($text, 0, 50));
                }
            }

            // Small delay to prevent CPU overload when there are no updates
            usleep(100000); // 0.1 second
        }

        return 0;
    }
}
