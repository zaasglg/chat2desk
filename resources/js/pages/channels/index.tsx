import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Edit, Trash2, Power, PowerOff, Bot, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface TelegramBotInfo {
    id: number;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
}

interface Props {
    channels: (Channel & { 
        chats_count: number;
        bot_info?: TelegramBotInfo;
    })[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Каналы', href: '/channels' },
];

export default function ChannelsIndex({ channels }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        bot_token: '',
    });

    const verifyToken = async () => {
        if (!data.bot_token) {
            setVerifyError('Введите токен бота');
            return;
        }

        setIsVerifying(true);
        setVerifyError(null);
        setBotInfo(null);

        try {
            const response = await fetch(`https://api.telegram.org/bot${data.bot_token}/getMe`);
            const result = await response.json();

            if (result.ok) {
                setBotInfo(result.result);
                if (!data.name) {
                    setData('name', result.result.first_name);
                }
            } else {
                setVerifyError(result.description || 'Неверный токен');
            }
        } catch (error) {
            setVerifyError('Ошибка проверки токена');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!botInfo && !editingChannel) {
            setVerifyError('Сначала проверьте токен');
            return;
        }

        if (editingChannel) {
            put(`/channels/${editingChannel.id}`, {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                    setEditingChannel(null);
                    setBotInfo(null);
                },
            });
        } else {
            post('/channels', {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                    setBotInfo(null);
                },
            });
        }
    };

    const handleEdit = (channel: Channel) => {
        setEditingChannel(channel);
        const credentials = channel.credentials as { bot_token?: string } | undefined;
        setData({
            name: channel.name,
            bot_token: credentials?.bot_token || '',
        });
        setIsOpen(true);
    };

    const handleDelete = (channel: Channel) => {
        if (confirm(`Удалить канал "${channel.name}"? Все чаты этого канала будут удалены.`)) {
            router.delete(`/channels/${channel.id}`);
        }
    };

    const handleToggle = (channel: Channel) => {
        router.post(`/channels/${channel.id}/toggle`);
    };

    const openDialog = () => {
        reset();
        setBotInfo(null);
        setVerifyError(null);
        setEditingChannel(null);
        setIsOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Telegram боты" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Telegram боты</h1>
                        <p className="text-muted-foreground">Подключите Telegram бота для приема сообщений</p>
                    </div>
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open);
                        if (!open) {
                            reset();
                            setEditingChannel(null);
                            setBotInfo(null);
                            setVerifyError(null);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button onClick={openDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Добавить бота
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Bot className="h-5 w-5" />
                                    {editingChannel ? 'Редактировать бота' : 'Подключить Telegram бота'}
                                </DialogTitle>
                                <DialogDescription>
                                    Получите токен бота у{' '}
                                    <a 
                                        href="https://t.me/BotFather" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                        @BotFather <ExternalLink className="h-3 w-3" />
                                    </a>
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="bot_token">Токен бота</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            id="bot_token"
                                            value={data.bot_token}
                                            onChange={(e) => {
                                                setData('bot_token', e.target.value);
                                                setBotInfo(null);
                                                setVerifyError(null);
                                            }}
                                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                            className="font-mono text-sm"
                                        />
                                        <Button 
                                            type="button" 
                                            variant="secondary"
                                            onClick={verifyToken}
                                            disabled={isVerifying || !data.bot_token}
                                        >
                                            {isVerifying ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                'Проверить'
                                            )}
                                        </Button>
                                    </div>
                                    {errors.bot_token && (
                                        <p className="text-sm text-red-500 mt-1">{errors.bot_token}</p>
                                    )}
                                </div>

                                {verifyError && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{verifyError}</AlertDescription>
                                    </Alert>
                                )}

                                {botInfo && (
                                    <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <AlertDescription className="text-green-700 dark:text-green-300">
                                            <div className="font-medium">{botInfo.first_name}</div>
                                            <div className="text-sm">@{botInfo.username}</div>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div>
                                    <Label htmlFor="name">Название канала</Label>
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Например: Поддержка"
                                        className="mt-1"
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Отмена
                                    </Button>
                                    <Button 
                                        type="submit" 
                                        disabled={processing || (!botInfo && !editingChannel)}
                                    >
                                        {processing ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        {editingChannel ? 'Сохранить' : 'Подключить'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Help Card */}
                {channels.length === 0 && (
                    <Card className="mb-6 border-dashed">
                        <CardHeader>
                            <CardTitle className="text-lg">Как подключить Telegram бота?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">1</div>
                                <div>
                                    <p>Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@BotFather</a> в Telegram</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">2</div>
                                <div>
                                    <p>Отправьте команду <code className="bg-muted px-1 rounded">/newbot</code> и следуйте инструкциям</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">3</div>
                                <div>
                                    <p>Скопируйте полученный токен и вставьте его выше</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Channels Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {channels.map((channel) => {
                        const credentials = channel.credentials as { bot_token?: string; bot_username?: string } | undefined;
                        
                        return (
                            <Card key={channel.id} className={!channel.is_active ? 'opacity-60' : ''}>
                                <CardHeader className="flex flex-row items-start justify-between pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                                            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{channel.name}</CardTitle>
                                            {credentials?.bot_username && (
                                                <CardDescription>@{credentials.bot_username}</CardDescription>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleToggle(channel)}
                                            title={channel.is_active ? 'Отключить' : 'Включить'}
                                        >
                                            {channel.is_active ? (
                                                <Power className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <PowerOff className="h-4 w-4 text-gray-400" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(channel)}
                                            title="Редактировать"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(channel)}
                                            title="Удалить"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <Badge variant={channel.is_active ? 'default' : 'secondary'}>
                                            {channel.is_active ? 'Активен' : 'Отключен'}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {channel.chats_count} чатов
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {channels.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <Bot className="mx-auto mb-4 h-12 w-12" />
                            <p className="text-lg">Нет подключенных ботов</p>
                            <p className="text-sm">Добавьте Telegram бота для начала работы</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
