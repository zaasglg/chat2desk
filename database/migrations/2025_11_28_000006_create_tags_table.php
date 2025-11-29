<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color')->default('#3B82F6');
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('chat_tag', function (Blueprint $table) {
            $table->foreignId('chat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['chat_id', 'tag_id']);
        });

        Schema::create('client_tag', function (Blueprint $table) {
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['client_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_tag');
        Schema::dropIfExists('chat_tag');
        Schema::dropIfExists('tags');
    }
};
