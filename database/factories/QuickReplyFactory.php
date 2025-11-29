<?php

namespace Database\Factories;

use App\Models\QuickReply;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuickReplyFactory extends Factory
{
    protected $model = QuickReply::class;

    public function definition(): array
    {
        $templates = [
            ['title' => 'Приветствие', 'content' => 'Здравствуйте! Чем могу помочь?', 'shortcut' => '/hello', 'category' => 'Приветствия'],
            ['title' => 'Прощание', 'content' => 'Спасибо за обращение! Хорошего дня!', 'shortcut' => '/bye', 'category' => 'Прощания'],
            ['title' => 'Ожидание', 'content' => 'Пожалуйста, подождите, я уточню информацию.', 'shortcut' => '/wait', 'category' => 'Общие'],
            ['title' => 'Перевод на специалиста', 'content' => 'Сейчас переведу вас на специалиста, который сможет помочь.', 'shortcut' => '/transfer', 'category' => 'Общие'],
            ['title' => 'Благодарность', 'content' => 'Спасибо за ваше обращение!', 'shortcut' => '/thanks', 'category' => 'Прощания'],
        ];

        $template = $this->faker->randomElement($templates);

        return [
            'user_id' => null,
            'title' => $template['title'],
            'content' => $template['content'],
            'shortcut' => $template['shortcut'],
            'category' => $template['category'],
            'is_global' => true,
            'usage_count' => $this->faker->numberBetween(0, 100),
        ];
    }
}
