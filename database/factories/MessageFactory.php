<?php

namespace Database\Factories;

use App\Models\Message;
use App\Models\Chat;
use App\Models\Channel;
use App\Models\Client;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class MessageFactory extends Factory
{
    protected $model = Message::class;

    public function definition(): array
    {
        $direction = $this->faker->randomElement(['incoming', 'outgoing']);

        return [
            'chat_id' => Chat::factory(),
            'channel_id' => Channel::factory(),
            'client_id' => $direction === 'incoming' ? Client::factory() : null,
            'operator_id' => $direction === 'outgoing' ? User::factory() : null,
            'external_id' => $this->faker->optional()->uuid(),
            'direction' => $direction,
            'type' => 'text',
            'content' => $this->faker->sentence(rand(3, 15)),
            'attachments' => null,
            'metadata' => [],
            'status' => $this->faker->randomElement(['sent', 'delivered', 'read']),
            'read_at' => $this->faker->optional(0.7)->dateTimeBetween('-1 hour', 'now'),
        ];
    }

    public function incoming(): static
    {
        return $this->state(fn (array $attributes) => [
            'direction' => 'incoming',
            'operator_id' => null,
        ]);
    }

    public function outgoing(): static
    {
        return $this->state(fn (array $attributes) => [
            'direction' => 'outgoing',
            'client_id' => null,
        ]);
    }
}
