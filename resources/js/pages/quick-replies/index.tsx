import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type QuickReply } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Edit, Trash2, Zap, Search } from 'lucide-react';
import { useState } from 'react';

interface Props {
    quickReplies: QuickReply[];
    categories: string[];
    filters: { search?: string; category?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Быстрые ответы', href: '/quick-replies' },
];

export default function QuickRepliesIndex({ quickReplies, categories, filters }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
    const [search, setSearch] = useState(filters.search || '');

    const { data, setData, post, patch, processing, reset, errors } = useForm({
        title: '',
        content: '',
        shortcut: '',
        category: '',
        is_global: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingReply) {
            patch(`/quick-replies/${editingReply.id}`, {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                    setEditingReply(null);
                },
            });
        } else {
            post('/quick-replies', {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                },
            });
        }
    };

    const handleEdit = (reply: QuickReply) => {
        setEditingReply(reply);
        setData({
            title: reply.title,
            content: reply.content,
            shortcut: reply.shortcut || '',
            category: reply.category || '',
            is_global: reply.is_global,
        });
        setIsOpen(true);
    };

    const handleDelete = (reply: QuickReply) => {
        if (confirm(`Удалить "${reply.title}"?`)) {
            router.delete(`/quick-replies/${reply.id}`);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/quick-replies', { search, category: filters.category }, { preserveState: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Быстрые ответы" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Быстрые ответы</h1>
                    <div className="flex gap-4">
                        <form onSubmit={handleSearch} className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск..."
                                    className="w-60 pl-10"
                                />
                            </div>
                            <Select
                                value={filters.category || 'all'}
                                onValueChange={(v) => router.get('/quick-replies', {
                                    search: filters.search,
                                    category: v === 'all' ? undefined : v,
                                }, { preserveState: true })}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Категория" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Все категории</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </form>
                        <Dialog open={isOpen} onOpenChange={(open) => {
                            setIsOpen(open);
                            if (!open) {
                                reset();
                                setEditingReply(null);
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Добавить
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingReply ? 'Редактировать' : 'Новый быстрый ответ'}
                                    </DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <Label htmlFor="title">Название</Label>
                                        <Input
                                            id="title"
                                            value={data.title}
                                            onChange={(e) => setData('title', e.target.value)}
                                            placeholder="Приветствие"
                                        />
                                        {errors.title && (
                                            <p className="text-sm text-red-500">{errors.title}</p>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="content">Текст сообщения</Label>
                                        <Textarea
                                            id="content"
                                            value={data.content}
                                            onChange={(e) => setData('content', e.target.value)}
                                            placeholder="Здравствуйте! Чем могу помочь?"
                                            rows={4}
                                        />
                                        {errors.content && (
                                            <p className="text-sm text-red-500">{errors.content}</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="shortcut">Сочетание (опционально)</Label>
                                            <Input
                                                id="shortcut"
                                                value={data.shortcut}
                                                onChange={(e) => setData('shortcut', e.target.value)}
                                                placeholder="/hello"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="category">Категория</Label>
                                            <Input
                                                id="category"
                                                value={data.category}
                                                onChange={(e) => setData('category', e.target.value)}
                                                placeholder="Приветствия"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="is_global"
                                            checked={data.is_global}
                                            onCheckedChange={(checked) => setData('is_global', !!checked)}
                                        />
                                        <Label htmlFor="is_global">
                                            Доступен всем операторам
                                        </Label>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            Отмена
                                        </Button>
                                        <Button type="submit" disabled={processing}>
                                            {editingReply ? 'Сохранить' : 'Создать'}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {quickReplies.map((reply) => (
                        <Card key={reply.id}>
                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-500" />
                                        {reply.title}
                                    </CardTitle>
                                    {reply.shortcut && (
                                        <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                                            {reply.shortcut}
                                        </code>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(reply)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(reply)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                                    {reply.content}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        {reply.category && (
                                            <Badge variant="secondary">{reply.category}</Badge>
                                        )}
                                        {reply.is_global && (
                                            <Badge variant="outline">Общий</Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        Использован: {reply.usage_count} раз
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {quickReplies.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            <Zap className="mx-auto mb-4 h-12 w-12" />
                            <p className="text-lg">Нет быстрых ответов</p>
                            <p className="text-sm">Создайте шаблоны для быстрых ответов</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
