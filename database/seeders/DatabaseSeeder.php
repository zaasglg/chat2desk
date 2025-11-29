<?php

namespace Database\Seeders;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\QuickReply;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create admin user
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Администратор',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'role' => 'admin',
                'is_online' => true,
            ]
        );

        // Create operators
        $operators = collect();
        $operatorNames = ['Иван Петров', 'Мария Сидорова', 'Алексей Козлов'];
        foreach ($operatorNames as $index => $name) {
            $operators->push(User::firstOrCreate(
                ['email' => 'operator' . ($index + 1) . '@example.com'],
                [
                    'name' => $name,
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'role' => 'operator',
                    'is_online' => $index < 2,
                ]
            ));
        }

        // Create channels
        $channelTypes = [
            ['name' => 'Telegram Support', 'type' => 'telegram'],
            ['name' => 'WhatsApp Business', 'type' => 'whatsapp'],
            ['name' => 'Instagram Direct', 'type' => 'instagram'],
            ['name' => 'Web Widget', 'type' => 'web'],
        ];

        $channels = collect();
        foreach ($channelTypes as $channelData) {
            $channels->push(Channel::firstOrCreate(
                ['name' => $channelData['name']],
                [
                    'type' => $channelData['type'],
                    'is_active' => true,
                    'settings' => [],
                ]
            ));
        }

        // Create clients and chats
        $clientNames = [
            'Анна Иванова', 'Петр Сергеев', 'Елена Козлова', 'Дмитрий Новиков',
            'Ольга Федорова', 'Михаил Соколов', 'Наталья Попова', 'Андрей Морозов',
            'Светлана Волкова', 'Николай Павлов'
        ];

        foreach ($clientNames as $index => $name) {
            $client = Client::create([
                'name' => $name,
                'phone' => '+7' . rand(900, 999) . rand(1000000, 9999999),
                'email' => strtolower(str_replace(' ', '.', $name)) . '@mail.ru',
                'notes' => $index % 3 === 0 ? 'Постоянный клиент' : null,
                'tags' => $index % 4 === 0 ? ['VIP'] : null,
            ]);

            $channel = $channels->random();
            $operator = $index % 3 !== 0 ? $operators->random() : null;
            $status = collect(['new', 'open', 'open', 'pending', 'resolved'])->random();

            $chat = Chat::create([
                'channel_id' => $channel->id,
                'client_id' => $client->id,
                'operator_id' => $operator?->id,
                'status' => $status,
                'priority' => $index % 5 === 0 ? 'high' : 'normal',
                'last_message_at' => now()->subMinutes(rand(1, 1440)),
                'unread_count' => $status === 'new' ? rand(1, 5) : 0,
            ]);

            // Create messages for each chat
            $messageCount = rand(3, 10);
            $messageTime = now()->subHours(rand(1, 48));

            $greetings = ['Здравствуйте!', 'Добрый день!', 'Привет!', 'Доброе утро!'];
            $questions = [
                'У меня вопрос по заказу.',
                'Подскажите, пожалуйста, как оформить возврат?',
                'Когда будет доставка?',
                'Не могу найти свой заказ.',
                'Как изменить адрес доставки?',
                'Есть ли скидки?',
            ];
            $responses = [
                'Добрый день! Чем могу помочь?',
                'Здравствуйте! Сейчас проверю информацию.',
                'Конечно, подскажу!',
                'Минуту, уточняю.',
            ];

            // First message from client
            Message::create([
                'chat_id' => $chat->id,
                'channel_id' => $channel->id,
                'client_id' => $client->id,
                'direction' => 'incoming',
                'type' => 'text',
                'content' => collect($greetings)->random() . ' ' . collect($questions)->random(),
                'status' => 'read',
                'created_at' => $messageTime,
                'updated_at' => $messageTime,
            ]);

            // Operator response if assigned
            if ($operator && $messageCount > 1) {
                $messageTime = $messageTime->addMinutes(rand(1, 30));
                Message::create([
                    'chat_id' => $chat->id,
                    'channel_id' => $channel->id,
                    'operator_id' => $operator->id,
                    'direction' => 'outgoing',
                    'type' => 'text',
                    'content' => collect($responses)->random(),
                    'status' => 'read',
                    'created_at' => $messageTime,
                    'updated_at' => $messageTime,
                ]);

                // Additional message exchange
                for ($i = 2; $i < $messageCount; $i++) {
                    $messageTime = $messageTime->addMinutes(rand(1, 15));
                    $isIncoming = $i % 2 === 0;

                    Message::create([
                        'chat_id' => $chat->id,
                        'channel_id' => $channel->id,
                        'client_id' => $isIncoming ? $client->id : null,
                        'operator_id' => !$isIncoming ? $operator->id : null,
                        'direction' => $isIncoming ? 'incoming' : 'outgoing',
                        'type' => 'text',
                        'content' => $isIncoming
                            ? collect(['Понял, спасибо!', 'Хорошо', 'А еще вопрос...', 'Ок'])->random()
                            : collect(['Пожалуйста!', 'Есть еще вопросы?', 'Рады помочь!'])->random(),
                        'status' => 'read',
                        'created_at' => $messageTime,
                        'updated_at' => $messageTime,
                    ]);
                }
            }
        }

        // Create quick replies
        $quickReplies = [
            ['title' => 'Приветствие', 'content' => 'Здравствуйте! Чем могу вам помочь?', 'shortcut' => '/hello', 'category' => 'Приветствия'],
            ['title' => 'Прощание', 'content' => 'Спасибо за обращение! Если возникнут вопросы - пишите. Хорошего дня!', 'shortcut' => '/bye', 'category' => 'Прощания'],
            ['title' => 'Ожидание', 'content' => 'Пожалуйста, подождите минуту, я уточню информацию.', 'shortcut' => '/wait', 'category' => 'Общие'],
            ['title' => 'Уточнение заказа', 'content' => 'Подскажите, пожалуйста, номер вашего заказа.', 'shortcut' => '/order', 'category' => 'Заказы'],
            ['title' => 'Время доставки', 'content' => 'Стандартная доставка занимает 2-3 рабочих дня.', 'shortcut' => '/delivery', 'category' => 'Доставка'],
            ['title' => 'Возврат', 'content' => 'Для оформления возврата, пожалуйста, заполните форму на нашем сайте в разделе "Возвраты".', 'shortcut' => '/return', 'category' => 'Возвраты'],
        ];

        foreach ($quickReplies as $reply) {
            QuickReply::firstOrCreate(
                ['shortcut' => $reply['shortcut']],
                array_merge($reply, ['is_global' => true, 'usage_count' => rand(0, 50)])
            );
        }
    }
}
