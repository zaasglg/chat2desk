import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type User } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Edit, Trash2, Circle, UserCog } from 'lucide-react';
import { useState } from 'react';

interface Props {
    operators: (User & { assigned_chats_count: number })[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Операторы', href: '/operators' },
];

const roleLabels = {
    admin: 'Администратор',
    operator: 'Оператор',
    viewer: 'Наблюдатель',
};

export default function OperatorsIndex({ operators }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingOperator, setEditingOperator] = useState<User | null>(null);

    const { data, setData, post, patch, processing, reset, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'operator' as 'admin' | 'operator' | 'viewer',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingOperator) {
            patch(`/operators/${editingOperator.id}`, {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                    setEditingOperator(null);
                },
            });
        } else {
            post('/operators', {
                onSuccess: () => {
                    setIsOpen(false);
                    reset();
                },
            });
        }
    };

    const handleEdit = (operator: User) => {
        setEditingOperator(operator);
        setData({
            name: operator.name,
            email: operator.email,
            password: '',
            password_confirmation: '',
            role: operator.role || 'operator',
        });
        setIsOpen(true);
    };

    const handleDelete = (operator: User) => {
        if (confirm(`Удалить оператора "${operator.name}"?`)) {
            router.delete(`/operators/${operator.id}`);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Операторы" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Операторы</h1>
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open);
                        if (!open) {
                            reset();
                            setEditingOperator(null);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Добавить оператора
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingOperator ? 'Редактировать оператора' : 'Новый оператор'}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Имя</Label>
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Имя оператора"
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-red-500">{errors.name}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="email@example.com"
                                    />
                                    {errors.email && (
                                        <p className="text-sm text-red-500">{errors.email}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="password">
                                        Пароль {editingOperator && '(оставьте пустым, чтобы не менять)'}
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="••••••••"
                                    />
                                    {errors.password && (
                                        <p className="text-sm text-red-500">{errors.password}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="password_confirmation">Подтверждение пароля</Label>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="role">Роль</Label>
                                    <Select
                                        value={data.role}
                                        onValueChange={(v) => setData('role', v as 'admin' | 'operator' | 'viewer')}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Администратор</SelectItem>
                                            <SelectItem value="operator">Оператор</SelectItem>
                                            <SelectItem value="viewer">Наблюдатель</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                        {editingOperator ? 'Сохранить' : 'Создать'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {operators.map((operator) => (
                        <Card key={operator.id}>
                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={operator.avatar} />
                                            <AvatarFallback>
                                                {operator.name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <Circle
                                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                                                operator.is_online
                                                    ? 'fill-green-500 text-green-500'
                                                    : 'fill-gray-400 text-gray-400'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{operator.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{operator.email}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(operator)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(operator)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary">
                                        <UserCog className="mr-1 h-3 w-3" />
                                        {roleLabels[operator.role || 'operator']}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {operator.assigned_chats_count} активных чатов
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {operators.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            <UserCog className="mx-auto mb-4 h-12 w-12" />
                            <p className="text-lg">Нет операторов</p>
                            <p className="text-sm">Добавьте первого оператора</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
