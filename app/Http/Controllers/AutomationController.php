<?php

namespace App\Http\Controllers;

use App\Models\Automation;
use App\Models\AutomationStep;
use App\Models\Channel;
use App\Models\Tag;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AutomationController extends Controller
{
    public function index()
    {
        $automations = Automation::with(['channel', 'steps'])
            ->withCount('logs')
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('automations/index', [
            'automations' => $automations,
        ]);
    }

    public function create()
    {
        $channels = Channel::where('is_active', true)->get();
        $tags = Tag::orderBy('name')->get();
        $operators = \App\Models\User::orderBy('name')->get(['id', 'name', 'email']);

        return Inertia::render('automations/create', [
            'channels' => $channels,
            'tags' => $tags,
            'operators' => $operators,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'channel_id' => 'nullable|exists:channels,id',
            'trigger' => 'required|in:new_chat,keyword,no_response,scheduled',
            'trigger_config' => 'nullable|array',
            'is_active' => 'boolean',
            'steps' => 'required|array|min:1',
            'steps.*.step_id' => 'required|string',
            'steps.*.type' => 'required|in:send_text,send_image,send_video,send_file,delay,condition,assign_operator,add_tag,remove_tag,close_chat',
            'steps.*.config' => 'nullable|array',
            'steps.*.position' => 'nullable|array',
            'steps.*.next_step_id' => 'nullable|string',
            'steps.*.condition_true_step_id' => 'nullable|string',
            'steps.*.condition_false_step_id' => 'nullable|string',
        ]);

        $automation = Automation::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'channel_id' => $validated['channel_id'] ?? null,
            'trigger' => $validated['trigger'],
            'trigger_config' => $validated['trigger_config'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        foreach ($validated['steps'] as $order => $stepData) {
            AutomationStep::create([
                'automation_id' => $automation->id,
                'step_id' => $stepData['step_id'],
                'type' => $stepData['type'],
                'config' => $stepData['config'] ?? null,
                'position' => $stepData['position'] ?? null,
                'order' => $order,
                'next_step_id' => $stepData['next_step_id'] ?? null,
                'condition_true_step_id' => $stepData['condition_true_step_id'] ?? null,
                'condition_false_step_id' => $stepData['condition_false_step_id'] ?? null,
            ]);
        }

        return redirect()->route('automations.index')->with('success', 'Автоматизация создана');
    }

    public function edit(Automation $automation)
    {
        $automation->load('steps');
        $channels = Channel::where('is_active', true)->get();
        $tags = Tag::orderBy('name')->get();
        $operators = \App\Models\User::orderBy('name')->get(['id', 'name', 'email']);

        return Inertia::render('automations/edit', [
            'automation' => $automation,
            'channels' => $channels,
            'tags' => $tags,
            'operators' => $operators,
        ]);
    }

    public function update(Request $request, Automation $automation)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'channel_id' => 'nullable|exists:channels,id',
            'trigger' => 'required|in:new_chat,keyword,no_response,scheduled',
            'trigger_config' => 'nullable|array',
            'is_active' => 'boolean',
            'steps' => 'required|array|min:1',
            'steps.*.step_id' => 'required|string',
            'steps.*.type' => 'required|in:send_text,send_image,send_video,send_file,delay,condition,assign_operator,add_tag,remove_tag,close_chat',
            'steps.*.config' => 'nullable|array',
            'steps.*.position' => 'nullable|array',
            'steps.*.next_step_id' => 'nullable|string',
            'steps.*.condition_true_step_id' => 'nullable|string',
            'steps.*.condition_false_step_id' => 'nullable|string',
        ]);

        $automation->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'channel_id' => $validated['channel_id'] ?? null,
            'trigger' => $validated['trigger'],
            'trigger_config' => $validated['trigger_config'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        // Delete old steps and create new ones
        $automation->steps()->delete();

        foreach ($validated['steps'] as $order => $stepData) {
            AutomationStep::create([
                'automation_id' => $automation->id,
                'step_id' => $stepData['step_id'],
                'type' => $stepData['type'],
                'config' => $stepData['config'] ?? null,
                'position' => $stepData['position'] ?? null,
                'order' => $order,
                'next_step_id' => $stepData['next_step_id'] ?? null,
                'condition_true_step_id' => $stepData['condition_true_step_id'] ?? null,
                'condition_false_step_id' => $stepData['condition_false_step_id'] ?? null,
            ]);
        }

        return redirect()->route('automations.index')->with('success', 'Автоматизация обновлена');
    }

    public function destroy(Automation $automation)
    {
        $automation->delete();

        return redirect()->route('automations.index')->with('success', 'Автоматизация удалена');
    }

    public function toggle(Automation $automation)
    {
        $automation->update(['is_active' => !$automation->is_active]);

        return back()->with('success', $automation->is_active ? 'Автоматизация включена' : 'Автоматизация выключена');
    }
}
