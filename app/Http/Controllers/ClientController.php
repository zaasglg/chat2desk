<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Services\AutomationService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $query = Client::with('tags')
            ->withCount('chats')
            ->orderBy('updated_at', 'desc');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $clients = $query->paginate(50);

        return Inertia::render('clients/index', [
            'clients' => $clients,
            'filters' => $request->only(['search']),
        ]);
    }

    public function show(Client $client)
    {
        $client->load(['tags', 'chats' => function ($q) {
            $q->with(['channel', 'operator'])->latest();
        }]);

        return Inertia::render('clients/show', [
            'client' => $client,
        ]);
    }

    public function update(Request $request, Client $client)
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string',
        ]);

        $client->update($request->only(['name', 'phone', 'email', 'notes']));

        return back()->with('success', 'Клиент обновлен');
    }

    public function syncTags(Request $request, Client $client)
    {
        try {
            $request->validate([
                'tag_ids' => 'nullable|array',
                'tag_ids.*' => 'exists:tags,id',
            ]);

            // Get current tag IDs before sync (as integers)
            $oldTagIds = $client->tags()->pluck('tags.id')->map(fn($id) => (int)$id)->toArray();
            $newTagIds = array_map('intval', $request->tag_ids ?? []);

            \Log::info('syncTags called', [
                'client_id' => $client->id,
                'old_tag_ids' => $oldTagIds,
                'new_tag_ids' => $newTagIds,
            ]);

            // Sync tags
            $client->tags()->sync($newTagIds);

            // Find added and removed tags
            $addedTagIds = array_values(array_diff($newTagIds, $oldTagIds));
            $removedTagIds = array_values(array_diff($oldTagIds, $newTagIds));

            \Log::info('Tag changes detected', [
                'client_id' => $client->id,
                'added_tag_ids' => $addedTagIds,
                'removed_tag_ids' => $removedTagIds,
            ]);

            // Trigger automations for tag changes
            if (!empty($addedTagIds) || !empty($removedTagIds)) {
                // Find an active chat for this client to trigger automations
                $chat = $client->chats()->orderBy('last_message_at', 'desc')->first();
                
                \Log::info('Looking for chat to trigger automation', [
                    'client_id' => $client->id,
                    'chat_found' => $chat ? true : false,
                    'chat_id' => $chat?->id,
                    'chat_channel_id' => $chat?->channel_id,
                ]);
                
                if ($chat) {
                    $automationService = app(AutomationService::class);
                    
                    if (!empty($addedTagIds)) {
                        \Log::info('Calling triggerTagAdded', [
                            'chat_id' => $chat->id,
                            'tag_ids' => $addedTagIds,
                        ]);
                        $automationService->triggerTagAdded($chat, $addedTagIds);
                    }
                    
                    if (!empty($removedTagIds)) {
                        \Log::info('Calling triggerTagRemoved', [
                            'chat_id' => $chat->id,
                            'tag_ids' => $removedTagIds,
                        ]);
                        $automationService->triggerTagRemoved($chat, $removedTagIds);
                    }
                } else {
                    \Log::warning('No chat found for client, cannot trigger tag automations', [
                        'client_id' => $client->id,
                    ]);
                }
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            \Log::error('syncTags error', [
                'client_id' => $client->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function updateNotes(Request $request, Client $client)
    {
        $request->validate([
            'notes' => 'nullable|string|max:5000',
        ]);

        $client->update(['notes' => $request->notes]);

        return response()->json(['success' => true]);
    }

    public function destroy(Client $client)
    {
        // Detach all tags before deletion
        $client->tags()->detach();
        
        // Delete client (chats and messages will be deleted automatically via cascade)
        $client->delete();

        return redirect()->route('clients.index')->with('success', 'Клиент и все его чаты удалены');
    }
}
