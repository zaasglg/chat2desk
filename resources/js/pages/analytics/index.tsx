import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    MessageSquare,
    ArrowDownLeft,
    ArrowUpRight,
    Clock,
    CheckCircle,
    BarChart3,
} from 'lucide-react';

interface Props {
    stats: {
        total_chats: number;
        total_messages: number;
        incoming_messages: number;
        outgoing_messages: number;
        resolved_chats: number;
        avg_response_time: number;
    };
    channelStats: (Channel & { chats_count: number; messages_count: number })[];
    messagesByDay: Record<string, { incoming: number; outgoing: number }>;
    chatsByStatus: Record<string, number>;
    period: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Аналитика', href: '/analytics' },
];

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

export default function AnalyticsIndex({ stats, channelStats, messagesByDay, chatsByStatus, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/analytics', { period: newPeriod }, { preserveState: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Аналитика" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Аналитика</h1>
                    <Select value={period} onValueChange={handlePeriodChange}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">24 часа</SelectItem>
                            <SelectItem value="7d">7 дней</SelectItem>
                            <SelectItem value="30d">30 дней</SelectItem>
                            <SelectItem value="90d">90 дней</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Main Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <StatCard
                        title="Всего чатов"
                        value={stats.total_chats}
                        icon={<MessageSquare className="h-4 w-4" />}
                    />
                    <StatCard
                        title="Всего сообщений"
                        value={stats.total_messages}
                        icon={<BarChart3 className="h-4 w-4" />}
                        description={`↓${stats.incoming_messages} / ↑${stats.outgoing_messages}`}
                    />
                    <StatCard
                        title="Решенные чаты"
                        value={stats.resolved_chats}
                        icon={<CheckCircle className="h-4 w-4" />}
                    />
                    <StatCard
                        title="Среднее время ответа"
                        value={`${stats.avg_response_time} мин`}
                        icon={<Clock className="h-4 w-4" />}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Channel Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Статистика по каналам</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {channelStats.map((channel) => (
                                    <div key={channel.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">
                                                {channelIcons[channel.type] || '📩'}
                                            </span>
                                            <div>
                                                <p className="font-medium">{channel.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {channel.type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 text-right">
                                            <div>
                                                <p className="text-sm font-medium">{channel.chats_count}</p>
                                                <p className="text-xs text-muted-foreground">чатов</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{channel.messages_count}</p>
                                                <p className="text-xs text-muted-foreground">сообщений</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {channelStats.length === 0 && (
                                    <p className="text-center text-muted-foreground py-4">
                                        Нет данных
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Чаты по статусу</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <StatusBar
                                    label="Новые"
                                    value={chatsByStatus.new || 0}
                                    total={Object.values(chatsByStatus).reduce((a, b) => a + b, 0)}
                                    color="bg-blue-500"
                                />
                                <StatusBar
                                    label="Открытые"
                                    value={chatsByStatus.open || 0}
                                    total={Object.values(chatsByStatus).reduce((a, b) => a + b, 0)}
                                    color="bg-green-500"
                                />
                                <StatusBar
                                    label="Ожидание"
                                    value={chatsByStatus.pending || 0}
                                    total={Object.values(chatsByStatus).reduce((a, b) => a + b, 0)}
                                    color="bg-yellow-500"
                                />
                                <StatusBar
                                    label="Решенные"
                                    value={chatsByStatus.resolved || 0}
                                    total={Object.values(chatsByStatus).reduce((a, b) => a + b, 0)}
                                    color="bg-gray-500"
                                />
                                <StatusBar
                                    label="Закрытые"
                                    value={chatsByStatus.closed || 0}
                                    total={Object.values(chatsByStatus).reduce((a, b) => a + b, 0)}
                                    color="bg-gray-400"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Messages Timeline */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Сообщения по дням</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2 h-40">
                            {Object.entries(messagesByDay).map(([date, data]) => {
                                const total = data.incoming + data.outgoing;
                                const maxHeight = Math.max(
                                    ...Object.values(messagesByDay).map((d) => d.incoming + d.outgoing)
                                );
                                const height = maxHeight > 0 ? (total / maxHeight) * 100 : 0;

                                return (
                                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                                            <div
                                                className="w-full bg-primary rounded-t"
                                                style={{ height: `${(data.outgoing / (maxHeight || 1)) * 100}%` }}
                                            />
                                            <div
                                                className="w-full bg-primary/50"
                                                style={{ height: `${(data.incoming / (maxHeight || 1)) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground rotate-45 origin-left">
                                            {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                );
                            })}
                            {Object.keys(messagesByDay).length === 0 && (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                    Нет данных за выбранный период
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4 justify-center mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-primary/50 rounded" />
                                <span className="text-sm">Входящие</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-primary rounded" />
                                <span className="text-sm">Исходящие</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function StatCard({
    title,
    value,
    icon,
    description,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    description?: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBar({
    label,
    value,
    total,
    color,
}: {
    label: string;
    value: number;
    total: number;
    color: string;
}) {
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return (
        <div>
            <div className="flex justify-between mb-1">
                <span className="text-sm">{label}</span>
                <span className="text-sm text-muted-foreground">{value}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
