<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AutomationController;
use App\Http\Controllers\ChannelController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\OperatorController;
use App\Http\Controllers\OperatorDemoController;
use App\Http\Controllers\OperatorGroupController;
use App\Http\Controllers\QuickReplyController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\TelegramWebhookController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\MediaStreamController;
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
    Route::post('chats/{chat}/mark-unread', [ChatController::class, 'markAsUnread'])->name('chats.mark-unread');

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
    Route::post('clients/{client}/notes', [ClientController::class, 'updateNotes'])->name('clients.update-notes');
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
    Route::get('operators/demo', [OperatorDemoController::class, 'index'])->name('operators.demo');
    Route::post('operators', [OperatorController::class, 'store'])->name('operators.store');
    Route::patch('operators/{operator}', [OperatorController::class, 'update'])->name('operators.update');
    Route::delete('operators/{operator}', [OperatorController::class, 'destroy'])->name('operators.destroy');
    Route::post('operators/toggle-online', [OperatorController::class, 'toggleOnline'])->name('operators.toggle-online');
    Route::get('api/operators/online', [OperatorController::class, 'online'])->name('operators.online');
    Route::get('api/users', [OperatorController::class, 'users'])->name('api.users');

    // Operator Groups
    Route::get('api/operator-groups', [OperatorGroupController::class, 'index'])->name('operator-groups.index');
    Route::post('api/operator-groups', [OperatorGroupController::class, 'store'])->name('operator-groups.store');
    Route::patch('api/operator-groups/{operatorGroup}', [OperatorGroupController::class, 'update'])->name('operator-groups.update');
    Route::delete('api/operator-groups/{operatorGroup}', [OperatorGroupController::class, 'destroy'])->name('operator-groups.destroy');
    Route::post('api/operator-groups/{operatorGroup}/operators', [OperatorGroupController::class, 'addOperator'])->name('operator-groups.add-operator');
    Route::delete('api/operator-groups/{operatorGroup}/operators/{user}', [OperatorGroupController::class, 'removeOperator'])->name('operator-groups.remove-operator');
    Route::patch('api/operator-groups/{operatorGroup}/operators/{user}', [OperatorGroupController::class, 'updateOperator'])->name('operator-groups.update-operator');
    Route::get('api/operator-groups/{operatorGroup}/operators', [OperatorGroupController::class, 'operators'])->name('operator-groups.operators');

    // Automations
    Route::get('automations', [AutomationController::class, 'index'])->name('automations.index');
    Route::get('automations/create', [AutomationController::class, 'create'])->name('automations.create');
    Route::post('automations', [AutomationController::class, 'store'])->name('automations.store');
    Route::get('automations/{automation}/edit', [AutomationController::class, 'edit'])->name('automations.edit');
    Route::patch('automations/{automation}', [AutomationController::class, 'update'])->name('automations.update');
    Route::delete('automations/{automation}', [AutomationController::class, 'destroy'])->name('automations.destroy');
    Route::post('automations/{automation}/toggle', [AutomationController::class, 'toggle'])->name('automations.toggle');

    // Broadcasts
    Route::get('broadcasts/create', [\App\Http\Controllers\BroadcastController::class, 'create'])->name('broadcasts.create');
    Route::post('broadcasts', [\App\Http\Controllers\BroadcastController::class, 'store'])->name('broadcasts.store');
    Route::post('broadcasts/count', [\App\Http\Controllers\BroadcastController::class, 'count'])->name('broadcasts.count');

    // Analytics
    Route::get('analytics', [AnalyticsController::class, 'index'])->name('analytics.index');
    Route::post('analytics/calculate', [AnalyticsController::class, 'calculate'])->name('analytics.calculate');
    Route::post('analytics/export', [AnalyticsController::class, 'export'])->name('analytics.export');

    // File Upload
    Route::post('api/upload/automation-file', [FileUploadController::class, 'uploadAutomationFile'])->name('upload.automation-file');
    Route::delete('api/upload/automation-file', [FileUploadController::class, 'deleteAutomationFile'])->name('delete.automation-file');

    // Media Streaming (for optimized video playback)
    Route::get('media/stream/{path}', [MediaStreamController::class, 'stream'])
        ->where('path', '.*')
        ->name('media.stream');
    Route::get('media/thumbnail/{path}', [MediaStreamController::class, 'thumbnail'])
        ->where('path', '.*')
        ->name('media.thumbnail');
});

// Telegram Webhook (public, no auth)
Route::post('telegram/webhook/{token}', [TelegramWebhookController::class, 'handle'])
    ->name('telegram.webhook');

require __DIR__.'/settings.php';
