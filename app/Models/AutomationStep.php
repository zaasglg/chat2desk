<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationStep extends Model
{
    protected $fillable = [
        'automation_id',
        'step_id',
        'type',
        'config',
        'position',
        'order',
        'next_step_id',
        'condition_true_step_id',
        'condition_false_step_id',
    ];

    protected $casts = [
        'config' => 'array',
        'position' => 'array',
    ];

    public function automation(): BelongsTo
    {
        return $this->belongsTo(Automation::class);
    }

    /**
     * Get step type label
     */
    public function getTypeLabelAttribute(): string
    {
        return match ($this->type) {
            'send_text' => 'Отправить текст',
            'send_text_with_buttons' => 'Отправить текст с кнопками',
            'send_image' => 'Отправить изображение',
            'send_video' => 'Отправить видео',
            'send_file' => 'Отправить файл',
            'delay' => 'Задержка',
            'condition' => 'Условие',
            'assign_operator' => 'Назначить оператора',
            'add_tag' => 'Добавить тег',
            'remove_tag' => 'Удалить тег',
            'close_chat' => 'Закрыть чат',
            default => $this->type,
        };
    }
}
