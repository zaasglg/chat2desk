import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Client, type PaginatedData } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Search, User, Phone, Mail, MessageSquare, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
    clients: PaginatedData<Client & { chats_count: number }>;
    filters: { search?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Клиенты', href: '/clients' },
];

export default function ClientsIndex({ clients, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/clients', { search }, { preserveState: true });
    };

    const handleDelete = (client: Client & { chats_count: number }) => {
        if (!confirm(`Удалить клиента "${client.name || 'Без имени'}"?\n\nЭто действие удалит:\n- Клиента\n- Все чаты (${client.chats_count})\n- Все сообщения\n\nЭто действие нельзя отменить.`)) {
            return;
        }

        router.delete(`/clients/${client.id}`, {
            onSuccess: () => {
                // Success message is handled by Inertia flash message
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Клиенты" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Клиенты</h1>
                    <form onSubmit={handleSearch} className="w-80">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Поиск клиентов..."
                                className="pl-10"
                            />
                        </div>
                    </form>
                </div>

                <div className="rounded-lg border">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium">Клиент</th>
                                <th className="px-4 py-3 text-left font-medium">Контакты</th>
                                <th className="px-4 py-3 text-left font-medium">Теги</th>
                                <th className="px-4 py-3 text-center font-medium">Чаты</th>
                                <th className="px-4 py-3 text-right font-medium">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {clients.data.map((client) => (
                                <tr key={client.id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={client.avatar} />
                                                <AvatarFallback>
                                                    <User className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">
                                                    {client.name || 'Без имени'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    ID: {client.id}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1">
                                            {client.phone && (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Phone className="h-3 w-3" />
                                                    {client.phone}
                                                </div>
                                            )}
                                            {client.email && (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Mail className="h-3 w-3" />
                                                    {client.email}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(client.tags) && client.tags.map((tag) => (
                                                <Badge 
                                                    key={tag.id} 
                                                    variant="secondary" 
                                                    className="text-xs"
                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge variant="outline">
                                            <MessageSquare className="mr-1 h-3 w-3" />
                                            {client.chats_count}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/clients/${client.id}`}>
                                                    Открыть
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(client)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                title="Удалить клиента и все чаты"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {clients.data.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                            <User className="mx-auto mb-4 h-12 w-12" />
                            <p>Клиенты не найдены</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {clients.last_page > 1 && (
                    <div className="mt-4 flex justify-center gap-2">
                        {Array.from({ length: clients.last_page }, (_, i) => i + 1).map((page) => (
                            <Button
                                key={page}
                                variant={page === clients.current_page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => router.get('/clients', { ...filters, page })}
                            >
                                {page}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
