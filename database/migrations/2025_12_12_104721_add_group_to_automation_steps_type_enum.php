<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            // Для MySQL нужно изменить enum, добавив новое значение 'group'
            DB::statement("ALTER TABLE automation_steps MODIFY COLUMN type ENUM('send_text', 'send_text_with_buttons', 'send_image', 'send_video', 'send_file', 'delay', 'condition', 'assign_operator', 'add_tag', 'remove_tag', 'close_chat', 'group') NOT NULL");
        } elseif ($driver === 'sqlite') {
            // SQLite не поддерживает изменение CHECK constraint напрямую
            // Нужно пересоздать таблицу с новым constraint
            DB::statement('PRAGMA foreign_keys=off;');
            
            DB::statement("
                CREATE TABLE automation_steps_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    automation_id INTEGER NOT NULL,
                    step_id VARCHAR(255) NOT NULL,
                    type VARCHAR(255) NOT NULL CHECK (type IN ('send_text', 'send_text_with_buttons', 'send_image', 'send_video', 'send_file', 'delay', 'condition', 'assign_operator', 'add_tag', 'remove_tag', 'close_chat', 'group')),
                    config TEXT,
                    position TEXT,
                    \"order\" INTEGER NOT NULL DEFAULT 0,
                    next_step_id VARCHAR(255),
                    condition_true_step_id VARCHAR(255),
                    condition_false_step_id VARCHAR(255),
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
                )
            ");
            
            // Копируем данные
            DB::statement("
                INSERT INTO automation_steps_new 
                SELECT * FROM automation_steps
            ");
            
            // Удаляем старую таблицу
            DB::statement("DROP TABLE automation_steps");
            
            // Переименовываем новую таблицу
            DB::statement("ALTER TABLE automation_steps_new RENAME TO automation_steps");
            
            // Восстанавливаем индексы
            DB::statement("CREATE INDEX automation_steps_automation_id_index ON automation_steps(automation_id)");
            
            DB::statement('PRAGMA foreign_keys=on;');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'mysql') {
            // Удаляем значение из enum (обратная миграция)
            // Но нужно сначала удалить все записи с типом 'group'
            DB::statement("DELETE FROM automation_steps WHERE type = 'group'");
            DB::statement("ALTER TABLE automation_steps MODIFY COLUMN type ENUM('send_text', 'send_text_with_buttons', 'send_image', 'send_video', 'send_file', 'delay', 'condition', 'assign_operator', 'add_tag', 'remove_tag', 'close_chat') NOT NULL");
        }
        // Для SQLite и других БД ничего не нужно делать в down()
    }
};
