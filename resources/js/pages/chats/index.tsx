import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel, type Chat, type ChatStats, type PaginatedData } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    MessageSquare,
    Search,
    User,
    Clock,
    AlertCircle,
    CheckCircle,
    Pause,
    Inbox,
} from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
    chats: PaginatedData<Chat>;
    channels: Channel[];
    stats: ChatStats;
    filters: {
        status?: string;
        channel_id?: string;
        operator_id?: string;
        search?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Чаты', href: '/chats' },
];

const statusColors = {
    new: 'bg-blue-500',
    open: 'bg-green-500',
    pending: 'bg-yellow-500',
    resolved: 'bg-gray-500',
    closed: 'bg-gray-400',
};

const statusLabels = {
    new: 'Новый',
    open: 'Открыт',
    pending: 'Ожидание',
    resolved: 'Решен',
    closed: 'Закрыт',
};

const priorityColors = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500',
};

const channelIcons: Record<string, string> = {
    telegram: '✈️',
    whatsapp: '📱',
    instagram: '📷',
    facebook: '👤',
    vk: '🔵',
    viber: '💜',
    email: '📧',
    web: '🌐',
};

export default function ChatsIndex({ chats, channels, stats, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/chats', { ...filters, search }, { preserveState: true });
    };

    const handleFilterChange = (key: string, value: string) => {
        router.get('/chats', { ...filters, [key]: value === 'all' ? undefined : value }, { preserveState: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Чаты" />
            <div className="flex h-full flex-col">
                {/* Stats Bar */}
                <div className="flex gap-4 border-b p-4">
                    <StatCard
                        icon={<Inbox className="h-4 w-4" />}
                        label="Новые"
                        value={stats.new}
                        active={filters.status === 'new'}
                        onClick={() => handleFilterChange('status', filters.status === 'new' ? 'all' : 'new')}
                    />
                    <StatCard
                        icon={<MessageSquare className="h-4 w-4" />}
                        label="Открытые"
                        value={stats.open}
                        active={filters.status === 'open'}
                        onClick={() => handleFilterChange('status', filters.status === 'open' ? 'all' : 'open')}
                    />
                    <StatCard
                        icon={<Pause className="h-4 w-4" />}
                        label="Ожидание"
                        value={stats.pending}
                        active={filters.status === 'pending'}
                        onClick={() => handleFilterChange('status', filters.status === 'pending' ? 'all' : 'pending')}
                    />
                    <StatCard
                        icon={<CheckCircle className="h-4 w-4" />}
                        label="Решенные"
                        value={stats.resolved}
                        active={filters.status === 'resolved'}
                        onClick={() => handleFilterChange('status', filters.status === 'resolved' ? 'all' : 'resolved')}
                    />
                    <StatCard
                        icon={<AlertCircle className="h-4 w-4" />}
                        label="Без оператора"
                        value={stats.unassigned}
                        active={filters.operator_id === 'unassigned'}
                        onClick={() => handleFilterChange('operator_id', filters.operator_id === 'unassigned' ? 'all' : 'unassigned')}
                        variant="warning"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 border-b p-4">
                    <form onSubmit={handleSearch} className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Поиск по имени, телефону, email..."
                                className="pl-10"
                            />
                        </div>
                    </form>
                    <Select
                        value={filters.channel_id || 'all'}
                        onValueChange={(v) => handleFilterChange('channel_id', v)}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Все каналы" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все каналы</SelectItem>
                            {channels.map((channel) => (
                                <SelectItem key={channel.id} value={String(channel.id)}>
                                    {channelIcons[channel.type]} {channel.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-auto">
                    {chats.data.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <MessageSquare className="mx-auto mb-4 h-12 w-12" />
                                <p>Нет чатов</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {chats.data.map((chat) => (
                                <ChatRow key={chat.id} chat={chat} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function StatCard({
    icon,
    label,
    value,
    active,
    onClick,
    variant = 'default',
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    active?: boolean;
    onClick?: () => void;
    variant?: 'default' | 'warning';
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${
                active
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-muted'
            } ${variant === 'warning' && value > 0 ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : ''}`}
        >
            {icon}
            <span className="text-sm font-medium">{label}</span>
            <Badge variant={active ? 'default' : 'secondary'}>{value}</Badge>
        </button>
    );
}

function ChatRow({ chat }: { chat: Chat }) {
    const lastMessage = chat.latest_message?.[0];

    return (
        <Link
            href={`/chats/${chat.id}`}
            className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
        >
            {/* Avatar */}
            <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    {chat.client?.avatar ? (
                        <img
                            src={chat.client.avatar}
                            alt={chat.client.name || ''}
                            className="h-full w-full rounded-full object-cover"
                        />
                    ) : (
                        <User className="h-6 w-6" />
                    )}
                </div>
                {/* Channel indicator */}
                <span className="absolute -bottom-1 -right-1 text-sm">
                    {channelIcons[chat.channel?.type || 'web']}
                </span>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                        {chat.client?.name || chat.client?.phone || `Клиент #${chat.client_id}`}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${statusColors[chat.status]}`} />
                    {chat.priority !== 'normal' && (
                        <AlertCircle className={`h-4 w-4 ${priorityColors[chat.priority]}`} />
                    )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                    {lastMessage?.content || 'Нет сообщений'}
                </p>
            </div>

            {/* Meta */}
            <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {chat.last_message_at
                        ? formatDistanceToNow(new Date(chat.last_message_at), {
                              addSuffix: true,
                              locale: ru,
                          })
                        : '—'}
                </span>
                {chat.unread_count > 0 && (
                    <Badge variant="default">{chat.unread_count}</Badge>
                )}
                {chat.operator && (
                    <span className="text-xs text-muted-foreground">
                        {chat.operator.name}
                    </span>
                )}
            </div>
        </Link>
    );
}
