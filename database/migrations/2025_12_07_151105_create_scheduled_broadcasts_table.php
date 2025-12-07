<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('scheduled_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->text('content');
            $table->string('attachment_path')->nullable();
            $table->json('filters')->nullable(); // Фильтры для выборки клиентов
            $table->json('mass_operations')->nullable(); // Массовые операции над чатами
            $table->boolean('is_scheduled')->default(false);
            $table->string('schedule_type')->nullable(); // 'once', 'daily', 'weekly', 'monthly'
            $table->json('schedule_config')->nullable(); // Дни недели, время и т.д.
            $table->timestamp('scheduled_at')->nullable(); // Для одноразовой рассылки
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamp('next_send_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sent_count')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scheduled_broadcasts');
    }
};
