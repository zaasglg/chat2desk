<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role', // admin, operator, viewer
        'qualification',
        'max_chats',
        'is_online',
        'last_seen_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_online' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    public function assignedChats(): HasMany
    {
        return $this->hasMany(Chat::class, 'operator_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'operator_id');
    }

    public function quickReplies(): HasMany
    {
        return $this->hasMany(QuickReply::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isOperator(): bool
    {
        return in_array($this->role, ['admin', 'operator']);
    }

    /**
     * Get groups this operator belongs to
     */
    public function operatorGroups(): BelongsToMany
    {
        return $this->belongsToMany(OperatorGroup::class, 'operator_group_user')
            ->withPivot('is_supervisor')
            ->withTimestamps();
    }

    /**
     * Check if user is supervisor in any group
     */
    public function isSupervisor(): bool
    {
        return $this->operatorGroups()->wherePivot('is_supervisor', true)->exists();
    }
}
