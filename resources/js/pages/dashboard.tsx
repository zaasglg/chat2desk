import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    MessageSquare,
    Users,
    Radio,
    TrendingUp,
    Clock,
    AlertCircle,
    CheckCircle,
    ArrowRight,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Дашборд',
        href: '/dashboard',
    },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Дашборд" />
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">Добро пожаловать в Chat2Desk</h1>
                    <p className="text-muted-foreground">Панель управления чатами и клиентами</p>
                </div>

                {/* Quick Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Активные чаты</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground">
                                Перейдите в раздел Чаты
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Клиенты</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground">
                                Всего клиентов в базе
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Каналы</CardTitle>
                            <Radio className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground">
                                Активных каналов
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Сообщений сегодня</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">—</div>
                            <p className="text-xs text-muted-foreground">
                                Входящих и исходящих
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="/chats" className="block">
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                    <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">Чаты</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Управление диалогами с клиентами
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/clients" className="block">
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">Клиенты</h3>
                                    <p className="text-sm text-muted-foreground">
                                        База клиентов и контакты
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/channels" className="block">
                        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <Radio className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">Каналы</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Telegram, WhatsApp, Instagram и другие
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Feature Highlights */}
                <div className="mt-8">
                    <h2 className="text-lg font-semibold mb-4">Возможности системы</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium">Мультиканальность</h4>
                                <p className="text-sm text-muted-foreground">
                                    Объединяйте все мессенджеры в одном окне
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium">Быстрые ответы</h4>
                                <p className="text-sm text-muted-foreground">
                                    Шаблоны для мгновенных ответов
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium">Командная работа</h4>
                                <p className="text-sm text-muted-foreground">
                                    Назначение чатов операторам
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium">Аналитика</h4>
                                <p className="text-sm text-muted-foreground">
                                    Статистика и отчеты по работе
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
