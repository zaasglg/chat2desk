<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class OperatorController extends Controller
{
    public function index()
    {
        $operators = User::withCount(['assignedChats' => function ($q) {
            $q->whereIn('status', ['new', 'open', 'pending']);
        }])
            ->orderBy('name')
            ->get();

        return Inertia::render('operators/index', [
            'operators' => $operators,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:8|confirmed',
            'role' => 'required|in:admin,operator,viewer',
        ]);

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
        ]);

        return back()->with('success', 'Оператор создан');
    }

    public function update(Request $request, User $operator)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $operator->id,
            'password' => 'nullable|min:8|confirmed',
            'role' => 'required|in:admin,operator,viewer',
        ]);

        $data = [
            'name' => $request->name,
            'email' => $request->email,
            'role' => $request->role,
        ];

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $operator->update($data);

        return back()->with('success', 'Оператор обновлен');
    }

    public function destroy(User $operator)
    {
        // Reassign chats to unassigned
        $operator->assignedChats()->update(['operator_id' => null]);

        $operator->delete();

        return back()->with('success', 'Оператор удален');
    }

    public function toggleOnline(Request $request)
    {
        $user = auth()->user();
        $user->update([
            'is_online' => !$user->is_online,
            'last_seen_at' => now(),
        ]);

        return response()->json([
            'is_online' => $user->is_online,
        ]);
    }

    public function online()
    {
        $operators = User::where('is_online', true)
            ->withCount(['assignedChats' => function ($q) {
                $q->whereIn('status', ['new', 'open', 'pending']);
            }])
            ->get(['id', 'name', 'email', 'is_online']);

        return response()->json($operators);
    }
}
