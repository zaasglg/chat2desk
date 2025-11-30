# Telegram Chat Setup Guide

## How to Run Telegram Polling Command

### Basic Command
```bash
php artisan telegram:poll
```

### Options
- **Poll specific channel**: `php artisan telegram:poll --channel=1`
- **Get help**: `php artisan telegram:poll --help`

### What the Command Does

The `TelegramPollCommand` performs long polling of Telegram channels to receive new messages in real-time:

1. **Deletes webhooks** - Required for long polling to work
2. **Starts polling loop** - Continuously checks for new messages
3. **Processes updates** - Creates chats and messages when new messages arrive
4. **Shows console output** - Displays incoming messages in real-time

### Important Notes

- **Keep running**: The command runs continuously until you stop it (Ctrl+C)
- **Active channels only**: Only polls Telegram channels marked as `is_active = true`
- **Database required**: Make sure your database is migrated and seeded first

### Step-by-Step Setup

1. **First, migrate and seed the database:**
   ```bash
   php artisan migrate:fresh --seed
   ```

2. **Check available Telegram channels:**
   ```bash
   php artisan tinker
   > \App\Models\Channel::where('type', 'telegram')->get()
   ```

3. **Start polling for all Telegram channels:**
   ```bash
   php artisan telegram:poll
   ```

4. **Or poll a specific channel (replace 1 with actual channel ID):**
   ```bash
   php artisan telegram:poll --channel=1
   ```

### Running in Background

To run the command in the background (so it continues after closing terminal):

**Windows:**
```bash
start /B php artisan telegram:poll
```

**Linux/Mac:**
```bash
nohup php artisan telegram:poll > telegram.log 2>&1 &
```

### Stopping the Command

- Press `Ctrl+C` in the terminal where it's running
- Or kill the process if running in background

### Troubleshooting

1. **No active Telegram channels found**
   - Make sure you have Telegram channels in your database
   - Check that `is_active = true` for your Telegram channels

2. **Permission errors**
   - Make sure your `.env` file has correct Telegram bot credentials
   - Verify `TELEGRAM_BOT_TOKEN` is set correctly

3. **Database connection errors**
   - Ensure database is accessible: `php artisan migrate:status`
   - Check `.env` database configuration

### Setting up Real-time Chat with Laravel Reverb

To enable real-time updates in your chat interface, you also need to set up Laravel Reverb:

```bash
# Install Laravel Reverb
composer require laravel/reverb

# Publish configuration
php artisan reverb:publish

# Start Reverb server
php artisan reverb:start

# In another terminal, start the polling
php artisan telegram:poll
```

This will enable:
- Real-time message updates in the chat interface
- Live operator notifications
- Instant chat status changes