<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Automation extends Model
{
    protected $fillable = [
        'name',
        'description',
        'channel_id',
        'trigger',
        'trigger_config',
        'is_active',
    ];

    protected $casts = [
        'trigger_config' => 'array',
        'is_active' => 'boolean',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(AutomationStep::class)->orderBy('order');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AutomationLog::class);
    }
}
