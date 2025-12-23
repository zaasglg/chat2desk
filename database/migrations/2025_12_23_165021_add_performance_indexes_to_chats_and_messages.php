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
        // Add indexes to chats table for faster queries
        Schema::table('chats', function (Blueprint $table) {
            // Index for duplicate detection query (MIN created_at by client_id)
            $table->index(['client_id', 'created_at'], 'chats_client_created_idx');
            
            // Index for ordering by last message
            $table->index('last_message_at', 'chats_last_message_idx');
            
            // Composite index for common filters
            $table->index(['channel_id', 'operator_id', 'last_message_at'], 'chats_channel_operator_last_msg_idx');
        });

        // Add indexes to messages table for faster unread count queries
        Schema::table('messages', function (Blueprint $table) {
            // Index for unread messages query
            $table->index(['chat_id', 'direction', 'read_at'], 'messages_unread_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->dropIndex('chats_client_created_idx');
            $table->dropIndex('chats_last_message_idx');
            $table->dropIndex('chats_channel_operator_last_msg_idx');
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_unread_idx');
        });
    }
};
