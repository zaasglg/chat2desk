<?php

namespace Database\Factories;

use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

class ClientFactory extends Factory
{
    protected $model = Client::class;

    public function definition(): array
    {
        return [
            'external_id' => $this->faker->optional()->uuid(),
            'name' => $this->faker->name(),
            'phone' => $this->faker->optional(0.8)->phoneNumber(),
            'email' => $this->faker->optional(0.5)->email(),
            'avatar' => null,
            'metadata' => [],
            'notes' => $this->faker->optional(0.3)->sentence(),
            'tags' => $this->faker->optional(0.3)->randomElements(['VIP', 'Проблемный', 'Новый', 'Лояльный'], rand(1, 2)),
        ];
    }
}
