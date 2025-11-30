<?php

namespace App\Http\Controllers;

use App\Models\OperatorGroup;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OperatorDemoController extends Controller
{
    public function index()
    {
        // Get all operators with their relationships
        $operators = User::with(['operatorGroups' => function ($query) {
            $query->select('id', 'name', 'color')
                  ->withPivot('is_supervisor');
        }])
        ->withCount(['assignedChats' => function ($q) {
            $q->whereIn('status', ['new', 'open', 'pending']);
        }])
        ->orderBy('name')
        ->get()
        ->map(function ($user) {
            // Add mock performance data
            $user->performance = [
                'total_chats' => rand(50, 300),
                'resolved_chats' => rand(40, 280),
                'avg_response_time' => rand(15, 45) / 10, // 1.5 to 4.5 minutes
                'customer_satisfaction' => rand(35, 50) / 10, // 3.5 to 5.0
            ];

            $user->performance['resolution_rate'] = 
                $user->performance['total_chats'] > 0 
                    ? ($user->performance['resolved_chats'] / $user->performance['total_chats']) * 100
                    : 0;

            return $user;
        });

        // Get operator groups with counts
        $groups = OperatorGroup::withCount('operators')
            ->orderBy('name')
            ->get();

        // Calculate overall stats
        $stats = [
            'total_operators' => $operators->count(),
            'online_operators' => $operators->where('is_online', true)->count(),
            'total_active_chats' => $operators->sum('assigned_chats_count'),
            'avg_response_time' => $operators->avg('performance.avg_response_time'),
            'avg_satisfaction' => $operators->avg('performance.customer_satisfaction'),
            'total_messages_today' => rand(150, 500),
        ];

        return Inertia::render('operators/demo', [
            'operators' => $operators,
            'groups' => $groups,
            'stats' => $stats,
        ]);
    }
}