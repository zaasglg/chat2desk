<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class OperatorGroup extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'color',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get operators in this group
     */
    public function operators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'operator_group_user')
            ->withPivot('is_supervisor')
            ->withTimestamps();
    }

    /**
     * Get supervisors of this group
     */
    public function supervisors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'operator_group_user')
            ->withPivot('is_supervisor')
            ->wherePivot('is_supervisor', true)
            ->withTimestamps();
    }

    /**
     * Get regular operators (non-supervisors) of this group
     */
    public function regularOperators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'operator_group_user')
            ->withPivot('is_supervisor')
            ->wherePivot('is_supervisor', false)
            ->withTimestamps();
    }
}
