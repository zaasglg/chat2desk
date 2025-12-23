<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ChannelController extends Controller
{
    public function index()
    {
        $channels = Channel::where('type', 'telegram')
            ->withCount('chats')
            ->get();

        return Inertia::render('channels/index', [
            'channels' => $channels,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'bot_token' => 'required|string',
            'disable_automations' => 'nullable|boolean',
        ]);

        // Verify bot token with Telegram API
        $response = Http::get("https://api.telegram.org/bot{$request->bot_token}/getMe");

        if (!$response->successful() || !$response->json('ok')) {
            return back()->withErrors(['bot_token' => 'Неверный токен бота']);
        }

        $botInfo = $response->json('result');

        // Check if bot already exists
        // Note: Using get() + filter because credentials is encrypted and whereJsonContains doesn't work with SQLite on encrypted columns
        $existingChannel = Channel::where('type', 'telegram')
            ->get()
            ->first(function ($channel) use ($botInfo) {
                return isset($channel->credentials['bot_id']) && $channel->credentials['bot_id'] == $botInfo['id'];
            });

        if ($existingChannel) {
            return back()->withErrors(['bot_token' => 'Этот бот уже подключен']);
        }

        // Generate unique webhook token
        $webhookToken = Str::random(64);

        $settings = [];
        if ($request->has('disable_automations')) {
            $settings['disable_automations'] = (bool) $request->disable_automations;
        }

        $channel = Channel::create([
            'name' => $request->name,
            'type' => 'telegram',
            'credentials' => [
                'bot_token' => $request->bot_token,
                'bot_id' => $botInfo['id'],
                'bot_username' => $botInfo['username'],
                'bot_first_name' => $botInfo['first_name'],
                'webhook_token' => $webhookToken,
            ],
            'is_active' => true,
            'settings' => $settings,
        ]);

        // Set webhook
        $this->setTelegramWebhook($request->bot_token, $webhookToken);

        return redirect()->route('channels.index')->with('success', 'Telegram бот подключен');
    }

    public function update(Request $request, Channel $channel)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'bot_token' => 'nullable|string',
            'disable_automations' => 'nullable|boolean',
        ]);

        $data = ['name' => $request->name];
        
        // Update settings - always update disable_automations if provided
        $settings = $channel->settings ?? [];
        if ($request->has('disable_automations')) {
            $settings['disable_automations'] = (bool) $request->disable_automations;
            \Log::info('Updating disable_automations setting', [
                'channel_id' => $channel->id,
                'disable_automations' => $settings['disable_automations'],
            ]);
        }
        $data['settings'] = $settings;

        // If token changed, verify it
        if ($request->filled('bot_token')) {
            $currentCredentials = $channel->credentials ?? [];
            $currentToken = $currentCredentials['bot_token'] ?? null;

            if ($request->bot_token !== $currentToken) {
                $response = Http::get("https://api.telegram.org/bot{$request->bot_token}/getMe");

                if (!$response->successful() || !$response->json('ok')) {
                    return back()->withErrors(['bot_token' => 'Неверный токен бота']);
                }

                $botInfo = $response->json('result');

                // Generate new webhook token
                $webhookToken = Str::random(64);

                $data['credentials'] = [
                    'bot_token' => $request->bot_token,
                    'bot_id' => $botInfo['id'],
                    'bot_username' => $botInfo['username'],
                    'bot_first_name' => $botInfo['first_name'],
                    'webhook_token' => $webhookToken,
                ];

                // Delete old webhook and set new
                if ($currentToken) {
                    $this->deleteTelegramWebhook($currentToken);
                }
                $this->setTelegramWebhook($request->bot_token, $webhookToken);
            } else {
                // Token not changed, but we should reinstall webhook to include callback_query
                $currentCredentials = $channel->credentials ?? [];
                $currentToken = $currentCredentials['bot_token'] ?? null;
                $currentWebhookToken = $currentCredentials['webhook_token'] ?? null;
                if ($currentToken && $currentWebhookToken) {
                    $this->setTelegramWebhook($currentToken, $currentWebhookToken);
                }
            }
        } else {
            // No token in request, but we should reinstall webhook to include callback_query
            $currentCredentials = $channel->credentials ?? [];
            $currentToken = $currentCredentials['bot_token'] ?? null;
            $currentWebhookToken = $currentCredentials['webhook_token'] ?? null;
            if ($currentToken && $currentWebhookToken) {
                $this->setTelegramWebhook($currentToken, $currentWebhookToken);
            }
        }

        $channel->update($data);

        return redirect()->route('channels.index')->with('success', 'Канал обновлен');
    }

    public function destroy(Channel $channel)
    {
        // Delete webhook before removing channel
        $credentials = $channel->credentials ?? [];
        if (isset($credentials['bot_token'])) {
            $this->deleteTelegramWebhook($credentials['bot_token']);
        }

        $channel->delete();

        return redirect()->route('channels.index')->with('success', 'Канал удален');
    }

    public function toggle(Channel $channel)
    {
        $channel->update(['is_active' => !$channel->is_active]);

        return back()->with('success', 'Статус канала изменен');
    }

    protected function setTelegramWebhook(string $botToken, string $webhookToken): bool
    {
        // Use public URL for webhooks (ngrok, Expose, etc.)
        $baseUrl = config('app.telegram_webhook_url') ?: url('/');
        $webhookUrl = rtrim($baseUrl, '/') . "/telegram/webhook/{$webhookToken}";

        $response = Http::post("https://api.telegram.org/bot{$botToken}/setWebhook", [
            'url' => $webhookUrl,
            'allowed_updates' => ['message', 'edited_message', 'callback_query'],
        ]);

        return $response->successful() && $response->json('ok');
    }

    protected function deleteTelegramWebhook(string $botToken): bool
    {
        $response = Http::post("https://api.telegram.org/bot{$botToken}/deleteWebhook");

        return $response->successful() && $response->json('ok');
    }
}
