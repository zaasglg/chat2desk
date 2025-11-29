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
        // Operator Groups table
        Schema::create('operator_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color')->default('#3b82f6');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Pivot table for operator-group relationship
        Schema::create('operator_group_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operator_group_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->boolean('is_supervisor')->default(false);
            $table->timestamps();

            $table->unique(['operator_group_id', 'user_id']);
        });

        // Add qualification field to users table
        Schema::table('users', function (Blueprint $table) {
            $table->integer('qualification')->default(0)->after('role'); // 0-100
            $table->integer('max_chats')->default(10)->after('qualification');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['qualification', 'max_chats']);
        });
        
        Schema::dropIfExists('operator_group_user');
        Schema::dropIfExists('operator_groups');
    }
};
