<?php

namespace App\Http\Controllers;

use App\Models\OperatorGroup;
use App\Models\User;
use Illuminate\Http\Request;

class OperatorGroupController extends Controller
{
    public function index()
    {
        $groups = OperatorGroup::withCount('operators')->orderBy('name')->get();
        
        return response()->json($groups);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:1000',
        ]);

        $group = OperatorGroup::create($validated);

        return response()->json($group->loadCount('operators'), 201);
    }

    public function update(Request $request, OperatorGroup $operatorGroup)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'color' => 'nullable|string|max:20',
            'description' => 'nullable|string|max:1000',
        ]);

        $operatorGroup->update($validated);

        return response()->json($operatorGroup->loadCount('operators'));
    }

    public function destroy(OperatorGroup $operatorGroup)
    {
        $operatorGroup->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Add operator to group
     */
    public function addOperator(Request $request, OperatorGroup $operatorGroup)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'is_supervisor' => 'boolean',
        ]);

        $operatorGroup->operators()->syncWithoutDetaching([
            $validated['user_id'] => ['is_supervisor' => $validated['is_supervisor'] ?? false]
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Remove operator from group
     */
    public function removeOperator(OperatorGroup $operatorGroup, User $user)
    {
        $operatorGroup->operators()->detach($user->id);

        return response()->json(['success' => true]);
    }

    /**
     * Update operator's supervisor status in group
     */
    public function updateOperator(Request $request, OperatorGroup $operatorGroup, User $user)
    {
        $validated = $request->validate([
            'is_supervisor' => 'required|boolean',
        ]);

        $operatorGroup->operators()->updateExistingPivot($user->id, [
            'is_supervisor' => $validated['is_supervisor'],
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Get operators in a group
     */
    public function operators(OperatorGroup $operatorGroup)
    {
        $operators = $operatorGroup->operators()
            ->withCount('assignedChats')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'qualification' => $user->qualification,
                    'max_chats' => $user->max_chats,
                    'is_online' => $user->is_online,
                    'is_supervisor' => $user->pivot->is_supervisor,
                    'assigned_chats_count' => $user->assigned_chats_count,
                ];
            });

        return response()->json($operators);
    }
}
