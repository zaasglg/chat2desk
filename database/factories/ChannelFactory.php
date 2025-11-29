<?php

namespace Database\Factories;

use App\Models\Channel;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChannelFactory extends Factory
{
    protected $model = Channel::class;

    public function definition(): array
    {
        $types = ['telegram', 'whatsapp', 'instagram', 'facebook', 'vk', 'viber', 'email', 'web'];
        $type = $this->faker->randomElement($types);

        $names = [
            'telegram' => 'Telegram Bot',
            'whatsapp' => 'WhatsApp Business',
            'instagram' => 'Instagram Direct',
            'facebook' => 'Facebook Messenger',
            'vk' => 'ВКонтакте',
            'viber' => 'Viber Bot',
            'email' => 'Email Support',
            'web' => 'Web Widget',
        ];

        return [
            'name' => $names[$type],
            'type' => $type,
            'is_active' => $this->faker->boolean(90),
            'settings' => [],
        ];
    }
}
