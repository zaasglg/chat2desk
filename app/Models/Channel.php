<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type', // telegram, whatsapp, instagram, facebook, vk, viber, email
        'credentials',
        'is_active',
        'settings',
    ];

    protected $casts = [
        'credentials' => 'encrypted:array',
        'settings' => 'array',
        'is_active' => 'boolean',
    ];

    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
