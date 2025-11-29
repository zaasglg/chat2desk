<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TagController extends Controller
{
    public function index()
    {
        $tags = Tag::withCount('clients')
            ->orderBy('name')
            ->get();

        return Inertia::render('tags/index', [
            'tags' => $tags,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:tags,name',
            'color' => 'required|string|max:7',
            'description' => 'nullable|string|max:500',
        ]);

        Tag::create($validated);

        return back()->with('success', 'Тег создан');
    }

    public function update(Request $request, Tag $tag)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:tags,name,' . $tag->id,
            'color' => 'required|string|max:7',
            'description' => 'nullable|string|max:500',
        ]);

        $tag->update($validated);

        return back()->with('success', 'Тег обновлен');
    }

    public function destroy(Tag $tag)
    {
        $tag->delete();

        return back()->with('success', 'Тег удален');
    }
}
