import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit, Play, Plus, Trash2, Workflow } from 'lucide-react';

interface Automation {
    id: number;
    name: string;
    description?: string;
    channel_id?: number;
    trigger: string;
    trigger_config?: Record<string, unknown>;
    is_active: boolean;
    steps_count?: number;
    logs_count?: number;
    channel?: {
        id: number;
        name: string;
        type: string;
    };
    steps?: Array<{
        id: number;
        type: string;
    }>;
}

interface Props {
    automations: Automation[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Автоматизации', href: '/automations' },
];

const triggerLabels: Record<string, string> = {
    new_chat: 'Новый чат',
    keyword: 'Ключевое слово',
    no_response: 'Нет ответа',
    scheduled: 'По расписанию',
};

export default function AutomationsIndex({ automations }: Props) {
    const handleToggle = (automation: Automation) => {
        router.post(`/automations/${automation.id}/toggle`, {}, { preserveScroll: true });
    };

    const handleDelete = (automation: Automation) => {
        if (confirm(`Удалить автоматизацию "${automation.name}"?`)) {
            router.delete(`/automations/${automation.id}`);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Автоматизации" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Автоматизации</h1>
                        <p className="text-muted-foreground">
                            Автоворонки и автоматические ответы
                        </p>
                    </div>

                    <Button asChild>
                        <Link href="/automations/create">
                            <Plus className="mr-2 h-4 w-4" />
                            Новая автоматизация
                        </Link>
                    </Button>
                </div>

                {/* Automations Grid */}
                {automations.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Нет автоматизаций</h3>
                            <p className="text-muted-foreground mb-4 text-center">
                                Создайте первую автоматизацию для автоматических ответов клиентам
                            </p>
                            <Button asChild>
                                <Link href="/automations/create">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Создать автоматизацию
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {automations.map((automation) => (
                            <Card key={automation.id} className="group relative">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                {automation.name}
                                                {automation.is_active ? (
                                                    <Badge variant="default" className="text-xs bg-green-500">
                                                        Активна
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Выключена
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                        </div>
                                        <Switch
                                            checked={automation.is_active}
                                            onCheckedChange={() => handleToggle(automation)}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {automation.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {automation.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline">
                                            <Play className="mr-1 h-3 w-3" />
                                            {triggerLabels[automation.trigger] || automation.trigger}
                                        </Badge>
                                        {automation.channel && (
                                            <Badge variant="outline">
                                                {automation.channel.name}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>{automation.steps?.length || 0} шагов</span>
                                        <span>{automation.logs_count || 0} запусков</span>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" className="flex-1" asChild>
                                            <Link href={`/automations/${automation.id}/edit`}>
                                                <Edit className="mr-1 h-4 w-4" />
                                                Редактировать
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(automation)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
