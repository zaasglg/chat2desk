<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledBroadcast extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'content',
        'attachment_path',
        'filters',
        'mass_operations',
        'is_scheduled',
        'schedule_type',
        'schedule_config',
        'scheduled_at',
        'last_sent_at',
        'next_send_at',
        'is_active',
        'sent_count',
    ];

    protected $casts = [
        'filters' => 'array',
        'mass_operations' => 'array',
        'schedule_config' => 'array',
        'is_scheduled' => 'boolean',
        'is_active' => 'boolean',
        'scheduled_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'next_send_at' => 'datetime',
        'sent_count' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
