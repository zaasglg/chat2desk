<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AutomationController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\OperatorController;
use App\Http\Controllers\QuickReplyController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\TelegramWebhookController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Chats
    Route::get('chats', [ChatController::class, 'index'])->name('chats.index');
    Route::get('chats/{chat}', [ChatController::class, 'show'])->name('chats.show');
    Route::post('chats/{chat}/assign', [ChatController::class, 'assign'])->name('chats.assign');
    Route::post('chats/{chat}/status', [ChatController::class, 'updateStatus'])->name('chats.status');
    Route::post('chats/{chat}/priority', [ChatController::class, 'updatePriority'])->name('chats.priority');

    // Messages
    Route::get('chats/{chat}/messages', [MessageController::class, 'index'])->name('messages.index');
    Route::post('chats/{chat}/messages', [MessageController::class, 'store'])->name('messages.store');
    Route::delete('messages/{message}', [MessageController::class, 'destroy'])->name('messages.destroy');

    // Channels
    Route::resource('channels', ChannelController::class);
    Route::post('channels/{channel}/toggle', [ChannelController::class, 'toggle'])->name('channels.toggle');

    // Clients
    Route::get('clients', [ClientController::class, 'index'])->name('clients.index');
    Route::get('clients/{client}', [ClientController::class, 'show'])->name('clients.show');
    Route::patch('clients/{client}', [ClientController::class, 'update'])->name('clients.update');
    Route::post('clients/{client}/tags', [ClientController::class, 'syncTags'])->name('clients.sync-tags');
    Route::delete('clients/{client}', [ClientController::class, 'destroy'])->name('clients.destroy');

    // Tags
    Route::get('tags', [TagController::class, 'index'])->name('tags.index');
    Route::post('tags', [TagController::class, 'store'])->name('tags.store');
    Route::patch('tags/{tag}', [TagController::class, 'update'])->name('tags.update');
    Route::delete('tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');

    // Quick Replies
    Route::get('quick-replies', [QuickReplyController::class, 'index'])->name('quick-replies.index');
    Route::post('quick-replies', [QuickReplyController::class, 'store'])->name('quick-replies.store');
    Route::patch('quick-replies/{quickReply}', [QuickReplyController::class, 'update'])->name('quick-replies.update');
    Route::delete('quick-replies/{quickReply}', [QuickReplyController::class, 'destroy'])->name('quick-replies.destroy');
    Route::post('quick-replies/{quickReply}/use', [QuickReplyController::class, 'use'])->name('quick-replies.use');
    Route::get('api/quick-replies/search', [QuickReplyController::class, 'search'])->name('quick-replies.search');

    // Operators
    Route::get('operators', [OperatorController::class, 'index'])->name('operators.index');
    Route::post('operators', [OperatorController::class, 'store'])->name('operators.store');
    Route::patch('operators/{operator}', [OperatorController::class, 'update'])->name('operators.update');
    Route::delete('operators/{operator}', [OperatorController::class, 'destroy'])->name('operators.destroy');
    Route::post('operators/toggle-online', [OperatorController::class, 'toggleOnline'])->name('operators.toggle-online');
    Route::get('api/operators/online', [OperatorController::class, 'online'])->name('operators.online');

    // Automations
    Route::get('automations', [AutomationController::class, 'index'])->name('automations.index');
    Route::get('automations/create', [AutomationController::class, 'create'])->name('automations.create');
    Route::post('automations', [AutomationController::class, 'store'])->name('automations.store');
    Route::get('automations/{automation}/edit', [AutomationController::class, 'edit'])->name('automations.edit');
    Route::patch('automations/{automation}', [AutomationController::class, 'update'])->name('automations.update');
    Route::delete('automations/{automation}', [AutomationController::class, 'destroy'])->name('automations.destroy');
    Route::post('automations/{automation}/toggle', [AutomationController::class, 'toggle'])->name('automations.toggle');

    // Analytics
    Route::get('analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
});

// Telegram Webhook (public, no auth)
Route::post('telegram/webhook/{token}', [TelegramWebhookController::class, 'handle'])
    ->name('telegram.webhook');

require __DIR__.'/settings.php';
