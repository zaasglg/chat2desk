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
        $driverName = DB::connection()->getDriverName();
        
        if ($driverName === 'sqlite') {
            // SQLite: recreate table with new enum values
            DB::statement('PRAGMA foreign_keys=off;');
            
            // Create new table with updated enum
            DB::statement("
                CREATE TABLE automations_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    channel_id INTEGER,
                    trigger VARCHAR(255) NOT NULL DEFAULT 'new_chat' CHECK(trigger IN ('new_chat', 'keyword', 'no_response', 'scheduled', 'tag_added', 'tag_removed', 'incoming_message', 'chat_opened', 'chat_closed')),
                    trigger_config TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
                )
            ");
            
            // Copy data
            DB::statement('INSERT INTO automations_new SELECT * FROM automations;');
            
            // Drop old table
            DB::statement('DROP TABLE automations;');
            
            // Rename new table
            DB::statement('ALTER TABLE automations_new RENAME TO automations;');
            
            DB::statement('PRAGMA foreign_keys=on;');
        } else {
            // MySQL: modify enum directly
            DB::statement("ALTER TABLE automations MODIFY COLUMN trigger ENUM('new_chat', 'keyword', 'no_response', 'scheduled', 'tag_added', 'tag_removed', 'incoming_message', 'chat_opened', 'chat_closed') NOT NULL DEFAULT 'new_chat'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driverName = DB::connection()->getDriverName();
        
        if ($driverName === 'sqlite') {
            // SQLite: recreate table with old enum values
            DB::statement('PRAGMA foreign_keys=off;');
            
            // Create new table with old enum
            DB::statement("
                CREATE TABLE automations_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    channel_id INTEGER,
                    trigger VARCHAR(255) NOT NULL DEFAULT 'new_chat' CHECK(trigger IN ('new_chat', 'keyword', 'no_response', 'scheduled', 'tag_added', 'tag_removed')),
                    trigger_config TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
                )
            ");
            
            // Copy data (only rows with valid trigger values)
            DB::statement("
                INSERT INTO automations_new 
                SELECT * FROM automations 
                WHERE trigger IN ('new_chat', 'keyword', 'no_response', 'scheduled', 'tag_added', 'tag_removed')
            ");
            
            // Drop old table
            DB::statement('DROP TABLE automations;');
            
            // Rename new table
            DB::statement('ALTER TABLE automations_new RENAME TO automations;');
            
            DB::statement('PRAGMA foreign_keys=on;');
        } else {
            // MySQL: revert enum
            DB::statement("ALTER TABLE automations MODIFY COLUMN trigger ENUM('new_chat', 'keyword', 'no_response', 'scheduled', 'tag_added', 'tag_removed') NOT NULL DEFAULT 'new_chat'");
        }
    }
};
