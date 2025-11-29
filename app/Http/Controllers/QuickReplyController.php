<?php

namespace App\Http\Controllers;

use App\Models\QuickReply;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QuickReplyController extends Controller
{
    public function index(Request $request)
    {
        $query = QuickReply::forUser(auth()->id())
            ->orderBy('usage_count', 'desc');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%")
                    ->orWhere('shortcut', 'like', "%{$search}%");
            });
        }

        if ($request->has('category') && $request->category) {
            $query->where('category', $request->category);
        }

        $quickReplies = $query->get();
        $categories = QuickReply::forUser(auth()->id())
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category');

        return Inertia::render('quick-replies/index', [
            'quickReplies' => $quickReplies,
            'categories' => $categories,
            'filters' => $request->only(['search', 'category']),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:100',
            'is_global' => 'boolean',
        ]);

        QuickReply::create([
            'user_id' => $request->is_global ? null : auth()->id(),
            'title' => $request->title,
            'content' => $request->content,
            'shortcut' => $request->shortcut,
            'category' => $request->category,
            'is_global' => $request->is_global ?? false,
        ]);

        return back()->with('success', 'Быстрый ответ создан');
    }

    public function update(Request $request, QuickReply $quickReply)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'shortcut' => 'nullable|string|max:50',
            'category' => 'nullable|string|max:100',
            'is_global' => 'boolean',
        ]);

        $quickReply->update([
            'title' => $request->title,
            'content' => $request->content,
            'shortcut' => $request->shortcut,
            'category' => $request->category,
            'is_global' => $request->is_global ?? false,
        ]);

        return back()->with('success', 'Быстрый ответ обновлен');
    }

    public function destroy(QuickReply $quickReply)
    {
        $quickReply->delete();

        return back()->with('success', 'Быстрый ответ удален');
    }

    public function use(QuickReply $quickReply)
    {
        $quickReply->increment('usage_count');

        return response()->json([
            'content' => $quickReply->content,
        ]);
    }

    // API для автозавершения
    public function search(Request $request)
    {
        $search = $request->get('q', '');

        $quickReplies = QuickReply::forUser(auth()->id())
            ->where(function ($query) use ($search) {
                $query->where('shortcut', 'like', "{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            })
            ->limit(10)
            ->get(['id', 'title', 'content', 'shortcut']);

        return response()->json($quickReplies);
    }
}
