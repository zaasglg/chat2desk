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
        $request->validate([
            'tag_ids' => 'array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        // Get current tag IDs before sync
        $oldTagIds = $client->tags()->pluck('tags.id')->toArray();
        $newTagIds = $request->tag_ids ?? [];

        // Sync tags
        $client->tags()->sync($newTagIds);

        // Find added and removed tags
        $addedTagIds = array_diff($newTagIds, $oldTagIds);
        $removedTagIds = array_diff($oldTagIds, $newTagIds);

        // Trigger automations for tag changes
        if (!empty($addedTagIds) || !empty($removedTagIds)) {
            // Find an active chat for this client to trigger automations
            $chat = $client->chats()->orderBy('last_message_at', 'desc')->first();
            
            if ($chat) {
                $automationService = app(AutomationService::class);
                
                if (!empty($addedTagIds)) {
                    $automationService->triggerTagAdded($chat, array_values($addedTagIds));
                }
                
                if (!empty($removedTagIds)) {
                    $automationService->triggerTagRemoved($chat, array_values($removedTagIds));
                }
            }
        }

        return response()->json(['success' => true]);
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
        $client->delete();

        return redirect()->route('clients.index')->with('success', 'Клиент удален');
    }
}
