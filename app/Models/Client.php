<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'external_id',
        'name',
        'phone',
        'email',
        'avatar',
        'metadata',
        'notes',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function getDisplayNameAttribute(): string
    {
        return $this->name ?: $this->phone ?: $this->email ?: 'Клиент #' . $this->id;
    }
}
