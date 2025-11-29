<?php

namespace Database\Factories;

use App\Models\Chat;
use App\Models\Channel;
use App\Models\Client;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChatFactory extends Factory
{
    protected $model = Chat::class;

    public function definition(): array
    {
        return [
            'channel_id' => Channel::factory(),
            'client_id' => Client::factory(),
            'operator_id' => $this->faker->optional(0.7)->randomElement(User::pluck('id')->toArray() ?: [null]),
            'status' => $this->faker->randomElement(['new', 'open', 'pending', 'resolved', 'closed']),
            'priority' => $this->faker->randomElement(['low', 'normal', 'normal', 'normal', 'high', 'urgent']),
            'subject' => $this->faker->optional(0.3)->sentence(3),
            'last_message_at' => $this->faker->dateTimeBetween('-7 days', 'now'),
            'unread_count' => $this->faker->numberBetween(0, 5),
            'metadata' => [],
        ];
    }
}
