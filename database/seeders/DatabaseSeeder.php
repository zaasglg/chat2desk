<?php

namespace Database\Seeders;

use App\Models\Channel;
use App\Models\Chat;
use App\Models\Client;
use App\Models\Message;
use App\Models\OperatorGroup;
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
        // Seed operator demo data first
        $this->call(OperatorDemoSeeder::class);

        // Get the created users for further operations
        $admin = User::where('email', 'admin@chatdesk.com')->first();
        $operators = User::whereIn('email', [
            'ivan.petrov@chatdesk.com',
            'maria.sidorova@chatdesk.com',
            'alexey.kozlov@chatdesk.com',
            'anna.volkova@chatdesk.com',
            'dmitry.novikov@chatdesk.com',
            'olga.fedorova@chatdesk.com',
            'mikhail.sokolov@chatdesk.com',
        ])->get();

        // Create basic channels if they don't exist
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
