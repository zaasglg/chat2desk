<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('external_id')->nullable()->index();
            $table->string('name')->nullable();
            $table->string('phone')->nullable()->index();
            $table->string('email')->nullable()->index();
            $table->string('avatar')->nullable();
            $table->json('metadata')->nullable();
            $table->text('notes')->nullable();
            $table->json('tags')->nullable();
            $table->timestamps();

            $table->index(['phone', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
