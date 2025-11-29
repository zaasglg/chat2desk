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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Tag } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Tags, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface Props {
    tags: (Tag & { clients_count: number })[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Теги', href: '/tags' },
];

const defaultColors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#ef4444', // red
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
];

export default function TagsIndex({ tags }: Props) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);

    const createForm = useForm({
        name: '',
        color: '#3b82f6',
        description: '',
    });

    const editForm = useForm({
        name: '',
        color: '',
        description: '',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/tags', {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTag) return;
        editForm.patch(`/tags/${editingTag.id}`, {
            onSuccess: () => {
                setEditingTag(null);
                editForm.reset();
            },
        });
    };

    const handleDelete = (tag: Tag) => {
        if (confirm(`Удалить тег "${tag.name}"?`)) {
            router.delete(`/tags/${tag.id}`);
        }
    };

    const openEditDialog = (tag: Tag) => {
        editForm.setData({
            name: tag.name,
            color: tag.color,
            description: tag.description || '',
        });
        setEditingTag(tag);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Теги" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Теги</h1>
                        <p className="text-muted-foreground">
                            Управление тегами для клиентов
                        </p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Новый тег
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Создать тег</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Название</Label>
                                    <Input
                                        id="name"
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                        placeholder="VIP клиент"
                                        required
                                    />
                                    {createForm.errors.name && (
                                        <p className="text-sm text-destructive">{createForm.errors.name}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Цвет</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {defaultColors.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                                    createForm.data.color === color
                                                        ? 'border-foreground scale-110'
                                                        : 'border-transparent'
                                                }`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => createForm.setData('color', color)}
                                            />
                                        ))}
                                        <Input
                                            type="color"
                                            value={createForm.data.color}
                                            onChange={(e) => createForm.setData('color', e.target.value)}
                                            className="h-8 w-8 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Описание</Label>
                                    <Textarea
                                        id="description"
                                        value={createForm.data.description}
                                        onChange={(e) => createForm.setData('description', e.target.value)}
                                        placeholder="Описание тега..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCreateOpen(false)}
                                    >
                                        Отмена
                                    </Button>
                                    <Button type="submit" disabled={createForm.processing}>
                                        Создать
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Tags Grid */}
                {tags.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Tags className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Нет тегов</h3>
                            <p className="text-muted-foreground mb-4">
                                Создайте первый тег для маркировки клиентов
                            </p>
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Создать тег
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {tags.map((tag) => (
                            <Card key={tag.id} className="group relative">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <Badge
                                            className="text-sm"
                                            style={{
                                                backgroundColor: tag.color + '20',
                                                color: tag.color,
                                                borderColor: tag.color,
                                            }}
                                        >
                                            {tag.name}
                                        </Badge>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => openEditDialog(tag)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(tag)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {tag.description && (
                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {tag.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span>{tag.clients_count} клиентов</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Edit Dialog */}
                <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Редактировать тег</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Название</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    required
                                />
                                {editForm.errors.name && (
                                    <p className="text-sm text-destructive">{editForm.errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Цвет</Label>
                                <div className="flex flex-wrap gap-2">
                                    {defaultColors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                                editForm.data.color === color
                                                    ? 'border-foreground scale-110'
                                                    : 'border-transparent'
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => editForm.setData('color', color)}
                                        />
                                    ))}
                                    <Input
                                        type="color"
                                        value={editForm.data.color}
                                        onChange={(e) => editForm.setData('color', e.target.value)}
                                        className="h-8 w-8 cursor-pointer p-0 border-0"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Описание</Label>
                                <Textarea
                                    id="edit-description"
                                    value={editForm.data.description}
                                    onChange={(e) => editForm.setData('description', e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingTag(null)}
                                >
                                    Отмена
                                </Button>
                                <Button type="submit" disabled={editForm.processing}>
                                    Сохранить
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
