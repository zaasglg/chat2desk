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
        // Автоматизации (автоворонки)
        Schema::create('automations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('trigger', ['new_chat', 'keyword', 'no_response', 'scheduled'])->default('new_chat');
            $table->json('trigger_config')->nullable(); // keywords, schedule, etc
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Шаги автоматизации (блоки на схеме)
        Schema::create('automation_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('automation_id')->constrained()->cascadeOnDelete();
            $table->string('step_id')->comment('UUID for frontend');
            $table->enum('type', ['send_text', 'send_image', 'send_video', 'send_file', 'delay', 'condition', 'assign_operator', 'add_tag', 'remove_tag', 'close_chat']);
            $table->json('config')->nullable(); // text, delay_seconds, condition, etc
            $table->json('position')->nullable(); // x, y for visual editor
            $table->integer('order')->default(0);
            $table->string('next_step_id')->nullable()->comment('Next step UUID');
            $table->string('condition_true_step_id')->nullable();
            $table->string('condition_false_step_id')->nullable();
            $table->timestamps();
        });

        // Логи выполнения автоматизаций
        Schema::create('automation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('automation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('current_step_id')->nullable();
            $table->enum('status', ['running', 'completed', 'paused', 'failed'])->default('running');
            $table->json('context')->nullable(); // variables, state
            $table->timestamp('next_run_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('automation_logs');
        Schema::dropIfExists('automation_steps');
        Schema::dropIfExists('automations');
    }
};
