import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type User, type OperatorGroup } from '@/types';
import { Head } from '@inertiajs/react';
import {
    Users,
    MessageSquare,
    Clock,
    TrendingUp,
    Star,
    Activity,
    Target,
    Award,
    UserCheck,
    AlertCircle,
    CheckCircle,
    Timer,
} from 'lucide-react';

interface Props {
    operators: (User & {
        assigned_chats_count: number;
        groups?: (OperatorGroup & { pivot: { is_supervisor: boolean } })[];
        performance?: {
            total_chats: number;
            resolved_chats: number;
            avg_response_time: number;
            customer_satisfaction: number;
            resolution_rate: number;
        };
    })[];
    groups: (OperatorGroup & { operators_count: number })[];
    stats: {
        total_operators: number;
        online_operators: number;
        total_active_chats: number;
        avg_response_time: number;
        avg_satisfaction: number;
        total_messages_today: number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Демо операторов', href: '/operators/demo' },
];

const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    operator: 'Оператор',
    viewer: 'Наблюдатель',
};

export default function OperatorsDemo({ operators, groups, stats }: Props) {
    const [selectedPeriod, setSelectedPeriod] = useState('today');

    const getPerformanceColor = (value: number, type: 'response' | 'satisfaction' | 'resolution') => {
        switch (type) {
            case 'response':
                return value <= 2 ? 'text-green-600' : value <= 4 ? 'text-yellow-600' : 'text-red-600';
            case 'satisfaction':
                return value >= 4.5 ? 'text-green-600' : value >= 4.0 ? 'text-yellow-600' : 'text-red-600';
            case 'resolution':
                return value >= 90 ? 'text-green-600' : value >= 80 ? 'text-yellow-600' : 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };

    const getPerformanceBadge = (value: number, type: 'response' | 'satisfaction' | 'resolution') => {
        switch (type) {
            case 'response':
                return value <= 2 ? 'default' : value <= 4 ? 'outline' : 'destructive';
            case 'satisfaction':
                return value >= 4.5 ? 'default' : value >= 4.0 ? 'outline' : 'destructive';
            case 'resolution':
                return value >= 90 ? 'default' : value >= 80 ? 'outline' : 'destructive';
            default:
                return 'secondary';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Демо операторов" />
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Демо админ-панели операторов</h1>
                        <p className="text-muted-foreground">
                            Комплексная аналитика и управление операторами
                        </p>
                    </div>
                    <Button onClick={() => window.location.reload()}>
                        <Activity className="h-4 w-4 mr-2" />
                        Обновить данные
                    </Button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Всего операторов</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_operators}</div>
                            <p className="text-xs text-muted-foreground">
                                <span className="text-green-600">{stats.online_operators} онлайн</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Активные чаты</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_active_chats}</div>
                            <p className="text-xs text-muted-foreground">
                                Сегодня обработано
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ср. время ответа</CardTitle>
                            <Timer className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.avg_response_time.toFixed(1)}м</div>
                            <p className="text-xs text-muted-foreground">
                                <span className={stats.avg_response_time <= 3 ? 'text-green-600' : 'text-red-600'}>
                                    {stats.avg_response_time <= 3 ? 'Отличный результат' : 'Требует улучшения'}
                                </span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Удовлетворенность</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.avg_satisfaction.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground">
                                <span className="text-yellow-600">из 5.0</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Groups Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Обзор групп операторов
                        </CardTitle>
                        <CardDescription>
                            Статистика по группам и их участникам
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {groups.map((group) => (
                                <div key={group.id} className="p-4 border rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: group.color }}
                                        />
                                        <span className="font-medium">{group.name}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {group.operators_count} операторов
                                    </div>
                                    <Progress
                                        value={(group.operators_count / Math.max(...groups.map(g => g.operators_count))) * 100}
                                        className="mt-2 h-2"
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Performance Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Производительность операторов
                        </CardTitle>
                        <CardDescription>
                            Детальная статистика по каждому оператору
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Оператор</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead className="text-center">Квалификация</TableHead>
                                    <TableHead className="text-center">Активные чаты</TableHead>
                                    <TableHead className="text-center">Время ответа</TableHead>
                                    <TableHead className="text-center">Удовлетворенность</TableHead>
                                    <TableHead className="text-center">Решено чатов</TableHead>
                                    <TableHead className="text-center">Статус</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {operators.map((operator) => {
                                    const performance = operator.performance || {
                                        total_chats: 0,
                                        resolved_chats: 0,
                                        avg_response_time: 0,
                                        customer_satisfaction: 0,
                                        resolution_rate: 0,
                                    };

                                    return (
                                        <TableRow key={operator.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={operator.avatar} />
                                                        <AvatarFallback>
                                                            {operator.name?.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{operator.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {operator.email}
                                                        </div>
                                                        {operator.groups && operator.groups.length > 0 && (
                                                            <div className="flex gap-1 mt-1">
                                                                {operator.groups.map((group) => (
                                                                    <Badge
                                                                        key={group.id}
                                                                        variant="outline"
                                                                        className="text-xs"
                                                                        style={{ borderColor: group.color }}
                                                                    >
                                                                        {group.name}
                                                                        {group.pivot?.is_supervisor && ' ⭐'}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {roleLabels[operator.role || 'operator']}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="font-medium">{operator.qualification || 0}</span>
                                                    <Award className="h-3 w-3 text-yellow-500" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="font-medium">{operator.assigned_chats_count}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        / {operator.max_chats || 10}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={(operator.assigned_chats_count / (operator.max_chats || 10)) * 100}
                                                    className="mt-1 h-1"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    <span
                                                        className={`font-medium ${getPerformanceColor(
                                                            performance.avg_response_time,
                                                            'response'
                                                        )}`}
                                                    >
                                                        {performance.avg_response_time.toFixed(1)}м
                                                    </span>
                                                </div>
                                                <Badge
                                                    variant={getPerformanceBadge(performance.avg_response_time, 'response')}
                                                    className="mt-1 text-xs"
                                                >
                                                    {performance.avg_response_time <= 2
                                                        ? 'Быстро'
                                                        : performance.avg_response_time <= 4
                                                        ? 'Средне'
                                                        : 'Медленно'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Star className="h-3 w-3 text-yellow-500" />
                                                    <span
                                                        className={`font-medium ${getPerformanceColor(
                                                            performance.customer_satisfaction,
                                                            'satisfaction'
                                                        )}`}
                                                    >
                                                        {performance.customer_satisfaction.toFixed(1)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                    <span>{performance.resolved_chats}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {performance.total_chats} всего
                                                </div>
                                                <div
                                                    className={`text-xs font-medium ${getPerformanceColor(
                                                        performance.resolution_rate,
                                                        'resolution'
                                                    )}`}
                                                >
                                                    {performance.resolution_rate.toFixed(0)}%
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center">
                                                    {operator.is_online ? (
                                                        <Badge variant="default" className="bg-green-500">
                                                            <UserCheck className="h-3 w-3 mr-1" />
                                                            Онлайн
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">
                                                            <AlertCircle className="h-3 w-3 mr-1" />
                                                            Оффлайн
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Real-time Activity */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Активность в реальном времени
                        </CardTitle>
                        <CardDescription>
                            Последние действия операторов
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {operators
                                .filter(op => op.is_online)
                                .slice(0, 5)
                                .map((operator) => (
                                    <div key={operator.id} className="flex items-center gap-3 p-2 border rounded">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={operator.avatar} />
                                            <AvatarFallback>
                                                {operator.name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{operator.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Обрабатывает {operator.assigned_chats_count} чатов
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-green-500">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-xs">Активен</span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}