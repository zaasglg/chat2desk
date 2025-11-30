<?php

namespace Database\Seeders;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\OperatorGroup;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class OperatorDemoSeeder extends Seeder
{
    /**
     * Seed demo operator data with comprehensive setup.
     */
    public function run(): void
    {
        // Create operator groups
        $groups = [
            [
                'name' => 'Техподдержка',
                'color' => '#3b82f6',
                'description' => 'Группа технической поддержки',
                'is_active' => true,
            ],
            [
                'name' => 'Продажи',
                'color' => '#10b981',
                'description' => 'Группа продаж и консультирования',
                'is_active' => true,
            ],
            [
                'name' => 'VIP клиенты',
                'color' => '#f59e0b',
                'description' => 'Группа работы с VIP клиентами',
                'is_active' => true,
            ],
            [
                'name' => 'Возвраты и жалобы',
                'color' => '#ef4444',
                'description' => 'Группа обработки возвратов и жалоб',
                'is_active' => true,
            ],
        ];

        $operatorGroups = collect();
        foreach ($groups as $groupData) {
            $operatorGroups->push(OperatorGroup::firstOrCreate(
                ['name' => $groupData['name']],
                $groupData
            ));
        }

        // Create admin users
        $admins = collect([
            [
                'name' => 'Александр Админов',
                'email' => 'admin@chatdesk.com',
                'role' => 'admin',
                'qualification' => 95,
                'max_chats' => 50,
                'is_online' => true,
                'groups' => [0, 1], // Admin in first two groups as supervisor
                'supervisor_groups' => [0],
            ],
            [
                'name' => 'Елена Супервайзер',
                'email' => 'supervisor@chatdesk.com',
                'role' => 'admin',
                'qualification' => 88,
                'max_chats' => 40,
                'is_online' => true,
                'groups' => [2, 3],
                'supervisor_groups' => [2],
            ],
        ]);

        // Create operators with realistic data
        $operators = collect([
            [
                'name' => 'Иван Петров',
                'email' => 'ivan.petrov@chatdesk.com',
                'role' => 'operator',
                'qualification' => 92,
                'max_chats' => 15,
                'is_online' => true,
                'groups' => [0],
                'supervisor_groups' => [],
                'stats' => [
                    'total_chats' => 245,
                    'resolved_chats' => 230,
                    'avg_response_time' => 2.5, // minutes
                    'customer_satisfaction' => 4.7,
                ],
            ],
            [
                'name' => 'Мария Сидорова',
                'email' => 'maria.sidorova@chatdesk.com',
                'role' => 'operator',
                'qualification' => 89,
                'max_chats' => 12,
                'is_online' => true,
                'groups' => [0, 2],
                'supervisor_groups' => [],
                'stats' => [
                    'total_chats' => 198,
                    'resolved_chats' => 185,
                    'avg_response_time' => 3.1,
                    'customer_satisfaction' => 4.5,
                ],
            ],
            [
                'name' => 'Алексей Козлов',
                'email' => 'alexey.kozlov@chatdesk.com',
                'role' => 'operator',
                'qualification' => 85,
                'max_chats' => 18,
                'is_online' => false,
                'groups' => [1],
                'supervisor_groups' => [],
                'stats' => [
                    'total_chats' => 167,
                    'resolved_chats' => 155,
                    'avg_response_time' => 4.2,
                    'customer_satisfaction' => 4.3,
                ],
            ],
            [
                'name' => 'Анна Волкова',
                'email' => 'anna.volkova@chatdesk.com',
                'role' => 'operator',
                'qualification' => 94,
                'max_chats' => 20,
                'is_online' => true,
                'groups' => [1, 2],
                'supervisor_groups' => [1],
                'stats' => [
                    'total_chats' => 312,
                    'resolved_chats' => 298,
                    'avg_response_time' => 1.8,
                    'customer_satisfaction' => 4.9,
                ],
            ],
            [
                'name' => 'Дмитрий Новиков',
                'email' => 'dmitry.novikov@chatdesk.com',
                'role' => 'operator',
                'qualification' => 78,
                'max_chats' => 10,
                'is_online' => false,
                'groups' => [3],
                'supervisor_groups' => [],
                'stats' => [
                    'total_chats' => 89,
                    'resolved_chats' => 78,
                    'avg_response_time' => 5.1,
                    'customer_satisfaction' => 4.1,
                ],
            ],
            [
                'name' => 'Ольга Федорова',
                'email' => 'olga.fedorova@chatdesk.com',
                'role' => 'operator',
                'qualification' => 91,
                'max_chats' => 16,
                'is_online' => true,
                'groups' => [2, 3],
                'supervisor_groups' => [3],
                'stats' => [
                    'total_chats' => 276,
                    'resolved_chats' => 264,
                    'avg_response_time' => 2.2,
                    'customer_satisfaction' => 4.8,
                ],
            ],
            [
                'name' => 'Михаил Соколов',
                'email' => 'mikhail.sokolov@chatdesk.com',
                'role' => 'viewer',
                'qualification' => 70,
                'max_chats' => 5,
                'is_online' => false,
                'groups' => [0],
                'supervisor_groups' => [],
                'stats' => [
                    'total_chats' => 45,
                    'resolved_chats' => 40,
                    'avg_response_time' => 6.5,
                    'customer_satisfaction' => 3.8,
                ],
            ],
        ]);

        // Create users
        $createdUsers = collect();

        // Create admins first
        foreach ($admins as $adminData) {
            $groups = collect($adminData['groups'])->map(fn($i) => $operatorGroups[$i]);
            $supervisorGroups = collect($adminData['supervisor_groups'])->map(fn($i) => $operatorGroups[$i]);

            $user = User::firstOrCreate(
                ['email' => $adminData['email']],
                [
                    'name' => $adminData['name'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'role' => $adminData['role'],
                    'qualification' => $adminData['qualification'],
                    'max_chats' => $adminData['max_chats'],
                    'is_online' => $adminData['is_online'],
                    'last_seen_at' => $adminData['is_online'] ? now() : now()->subHours(rand(1, 8)),
                ]
            );

            // Assign to groups and set supervisors
            foreach ($groups as $group) {
                $user->operatorGroups()->syncWithoutDetaching([
                    $group->id => ['is_supervisor' => $supervisorGroups->contains($group)]
                ]);
            }

            $createdUsers->push($user);
        }

        // Create operators
        foreach ($operators as $operatorData) {
            $groups = collect($operatorData['groups'])->map(fn($i) => $operatorGroups[$i]);
            $supervisorGroups = collect($operatorData['supervisor_groups'])->map(fn($i) => $operatorGroups[$i]);

            $user = User::firstOrCreate(
                ['email' => $operatorData['email']],
                [
                    'name' => $operatorData['name'],
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'role' => $operatorData['role'],
                    'qualification' => $operatorData['qualification'],
                    'max_chats' => $operatorData['max_chats'],
                    'is_online' => $operatorData['is_online'],
                    'last_seen_at' => $operatorData['is_online'] ? now() : now()->subHours(rand(1, 24)),
                ]
            );

            // Assign to groups and set supervisors
            foreach ($groups as $group) {
                $user->operatorGroups()->syncWithoutDetaching([
                    $group->id => ['is_supervisor' => $supervisorGroups->contains($group)]
                ]);
            }

            // Store stats for later use (you might want to create a separate stats table)
            $createdUsers->push($user);
        }

        // Create some realistic chat assignments based on operator data
        $this->createRealisticChats($createdUsers, $operatorGroups);
    }

    private function createRealisticChats($users, $operatorGroups)
    {
        $channels = Channel::all();
        $clients = Client::factory()->count(50)->create();

        foreach ($users as $user) {
            if ($user->role === 'viewer') continue; // Viewers don't get chats

            // Create realistic number of active chats for each operator
            $activeChatCount = min($user->max_chats, rand(3, $user->max_chats));
            
            for ($i = 0; $i < $activeChatCount; $i++) {
                $client = $clients->random();
                $channel = $channels->random();
                
                $chat = Chat::create([
                    'channel_id' => $channel->id,
                    'client_id' => $client->id,
                    'operator_id' => $user->id,
                    'status' => collect(['open', 'open', 'pending', 'new'])->random(),
                    'priority' => rand(1, 10) <= 2 ? 'high' : 'normal',
                    'last_message_at' => now()->subMinutes(rand(1, 180)),
                    'unread_count' => rand(0, 3),
                    'created_at' => now()->subHours(rand(1, 72)),
                ]);

                // Add some messages
                $this->createChatMessages($chat, $user, $client);
            }
        }
    }

    private function createChatMessages($chat, $operator, $client)
    {
        $messageCount = rand(3, 8);
        $messageTime = $chat->created_at;

        $greetings = ['Здравствуйте!', 'Добрый день!', 'Привет!'];
        $questions = [
            'У меня проблема с заказом.',
            'Подскажите статус доставки.',
            'Хочу вернуть товар.',
            'Есть вопрос по работе сайта.',
            'Нужна консультация.',
        ];
        $responses = [
            'Добрый день! Сейчас помогу.',
            'Понял, проверяю информацию.',
            'Конечно, подскажу детально.',
            'Минуту, уточняю данные.',
        ];

        // Client message
        Message::create([
            'chat_id' => $chat->id,
            'channel_id' => $chat->channel_id,
            'client_id' => $client->id,
            'direction' => 'incoming',
            'type' => 'text',
            'content' => collect($greetings)->random() . ' ' . collect($questions)->random(),
            'status' => 'read',
            'created_at' => $messageTime,
        ]);

        // Operator response
        if ($messageCount > 1) {
            $messageTime = $messageTime->addMinutes(rand(1, 10));
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $chat->channel_id,
                'operator_id' => $operator->id,
                'direction' => 'outgoing',
                'type' => 'text',
                'content' => collect($responses)->random(),
                'status' => 'read',
                'created_at' => $messageTime,
            ]);
        }
    }
}