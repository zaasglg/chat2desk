import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import GroupMembersModal from '@/components/operators/GroupMembersModal';
import { useState, useEffect } from 'react';

interface Props {
    operators: (User & { assigned_chats_count: number })[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Операторы', href: '/operators' },
];

const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    operator: 'Оператор',
    viewer: 'Наблюдатель',
};

export default function OperatorsIndex({ operators }: Props) {
    const [groups, setGroups] = useState<(OperatorGroup & { operators_count: number })[]>([]);
    const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false);
    const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
    const [editingOperator, setEditingOperator] = useState<User | null>(null);
    const [editingGroup, setEditingGroup] = useState<OperatorGroup | null>(null);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [membersGroup, setMembersGroup] = useState<OperatorGroup | null>(null);

    const operatorForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'operator' as 'admin' | 'operator' | 'viewer',
        qualification: 0,
        max_chats: 10,
    });

    const groupForm = useForm({
        name: '',
        color: '#3b82f6',
        description: '',
    });

    // Fetch groups
    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await fetch('/api/operator-groups');
            if (response.ok) {
                const data = await response.json();
                setGroups(data);
            }
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        }
    };

    const handleOperatorSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingOperator) {
            operatorForm.patch(`/operators/${editingOperator.id}`, {
                onSuccess: () => {
                    setIsOperatorDialogOpen(false);
                    operatorForm.reset();
                    setEditingOperator(null);
                },
            });
        } else {
            operatorForm.post('/operators', {
                onSuccess: () => {
                    setIsOperatorDialogOpen(false);
                    operatorForm.reset();
                },
            });
        }
    };

    const handleGroupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        
        try {
            const url = editingGroup 
                ? `/api/operator-groups/${editingGroup.id}` 
                : '/api/operator-groups';
            const method = editingGroup ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    name: groupForm.data.name,
                    color: groupForm.data.color,
                    description: groupForm.data.description,
                }),
            });

            if (response.ok) {
                setIsGroupDialogOpen(false);
                groupForm.reset();
                setEditingGroup(null);
                fetchGroups();
            }
        } catch (error) {
            console.error('Failed to save group:', error);
        }
    };

    const handleEditOperator = (operator: User) => {
        setEditingOperator(operator);
        operatorForm.setData({
            name: operator.name,
            email: operator.email,
            password: '',
            password_confirmation: '',
            role: operator.role || 'operator',
            qualification: operator.qualification || 0,
            max_chats: operator.max_chats || 10,
        });
        setIsOperatorDialogOpen(true);
    };

    const handleDeleteOperator = (operator: User) => {
        if (confirm(`Удалить оператора "${operator.name}"?`)) {
            router.delete(`/operators/${operator.id}`);
        }
    };

    const handleEditGroup = (group: OperatorGroup) => {
        setEditingGroup(group);
        groupForm.setData({
            name: group.name,
            color: group.color || '#3b82f6',
            description: group.description || '',
        });
        setIsGroupDialogOpen(true);
    };

    const handleDeleteGroup = async (group: OperatorGroup) => {
        if (!confirm(`Удалить группу "${group.name}"?`)) return;
        
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        try {
            const response = await fetch(`/api/operator-groups/${group.id}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': csrfToken },
            });
            if (response.ok) {
                fetchGroups();
            }
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    };

    const openMembersModal = (group: OperatorGroup) => {
        setMembersGroup(group);
        setIsMembersModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Операторы" />
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Группы и участники</h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Groups Table */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEditingGroup(null);
                                    groupForm.reset();
                                    setIsGroupDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Создать группу
                            </Button>
                        </div>

                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Название группы</TableHead>
                                        <TableHead className="text-center">Количество участников</TableHead>
                                        <TableHead className="text-right">Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groups.map((group) => (
                                        <TableRow key={group.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                                        style={{ backgroundColor: group.color + '20' }}
                                                    >
                                                        <Users className="h-4 w-4" style={{ color: group.color }} />
                                                    </div>
                                                    <span className="font-medium">{group.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {group.operators_count}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openMembersModal(group)}
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEditGroup(group)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteGroup(group)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {groups.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                                Нет групп
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Operators Table */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setEditingOperator(null);
                                    operatorForm.reset();
                                    setIsOperatorDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Добавить оператора
                            </Button>
                        </div>

                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Имя</TableHead>
                                        <TableHead className="text-center">Квалификация (0-100)</TableHead>
                                        <TableHead>Роль</TableHead>
                                        <TableHead className="text-right">Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {operators.map((operator) => (
                                        <TableRow key={operator.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={operator.avatar} />
                                                        <AvatarFallback>
                                                            {operator.name.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{operator.name}</div>
                                                        <div className="text-xs text-muted-foreground">{operator.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={operator.qualification || 0}
                                                    onChange={async (e) => {
                                                        const value = parseInt(e.target.value) || 0;
                                                        router.patch(`/operators/${operator.id}`, {
                                                            qualification: Math.min(100, Math.max(0, value)),
                                                        }, { preserveScroll: true });
                                                    }}
                                                    className="w-20 text-center mx-auto"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {roleLabels[operator.role || 'operator']}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEditOperator(operator)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteOperator(operator)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {operators.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                Нет операторов
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Operator Dialog */}
                <Dialog open={isOperatorDialogOpen} onOpenChange={(open) => {
                    setIsOperatorDialogOpen(open);
                    if (!open) {
                        operatorForm.reset();
                        setEditingOperator(null);
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingOperator ? 'Редактировать оператора' : 'Новый оператор'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleOperatorSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="name">Имя</Label>
                                <Input
                                    id="name"
                                    value={operatorForm.data.name}
                                    onChange={(e) => operatorForm.setData('name', e.target.value)}
                                    placeholder="Имя оператора"
                                />
                                {operatorForm.errors.name && (
                                    <p className="text-sm text-red-500">{operatorForm.errors.name}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={operatorForm.data.email}
                                    onChange={(e) => operatorForm.setData('email', e.target.value)}
                                    placeholder="email@example.com"
                                />
                                {operatorForm.errors.email && (
                                    <p className="text-sm text-red-500">{operatorForm.errors.email}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="password">
                                    Пароль {editingOperator && '(оставьте пустым, чтобы не менять)'}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={operatorForm.data.password}
                                    onChange={(e) => operatorForm.setData('password', e.target.value)}
                                    placeholder="••••••••"
                                />
                                {operatorForm.errors.password && (
                                    <p className="text-sm text-red-500">{operatorForm.errors.password}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="password_confirmation">Подтверждение пароля</Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={operatorForm.data.password_confirmation}
                                    onChange={(e) => operatorForm.setData('password_confirmation', e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="role">Роль</Label>
                                    <Select
                                        value={operatorForm.data.role}
                                        onValueChange={(v) => operatorForm.setData('role', v as 'admin' | 'operator' | 'viewer')}
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
                                <div>
                                    <Label htmlFor="qualification">Квалификация (0-100)</Label>
                                    <Input
                                        id="qualification"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={operatorForm.data.qualification}
                                        onChange={(e) => operatorForm.setData('qualification', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="max_chats">Макс. чатов</Label>
                                <Input
                                    id="max_chats"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={operatorForm.data.max_chats}
                                    onChange={(e) => operatorForm.setData('max_chats', parseInt(e.target.value) || 10)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsOperatorDialogOpen(false)}
                                >
                                    Отмена
                                </Button>
                                <Button type="submit" disabled={operatorForm.processing}>
                                    {editingOperator ? 'Сохранить' : 'Создать'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Group Dialog */}
                <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
                    setIsGroupDialogOpen(open);
                    if (!open) {
                        groupForm.reset();
                        setEditingGroup(null);
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingGroup ? 'Редактировать группу' : 'Новая группа'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleGroupSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="group-name">Название</Label>
                                <Input
                                    id="group-name"
                                    value={groupForm.data.name}
                                    onChange={(e) => groupForm.setData('name', e.target.value)}
                                    placeholder="Название группы"
                                />
                            </div>
                            <div>
                                <Label htmlFor="group-color">Цвет</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="group-color"
                                        type="color"
                                        value={groupForm.data.color}
                                        onChange={(e) => groupForm.setData('color', e.target.value)}
                                        className="w-16 h-10 p-1"
                                    />
                                    <Input
                                        value={groupForm.data.color}
                                        onChange={(e) => groupForm.setData('color', e.target.value)}
                                        placeholder="#3b82f6"
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="group-description">Описание</Label>
                                <Input
                                    id="group-description"
                                    value={groupForm.data.description}
                                    onChange={(e) => groupForm.setData('description', e.target.value)}
                                    placeholder="Описание группы"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsGroupDialogOpen(false)}
                                >
                                    Отмена
                                </Button>
                                <Button type="submit">
                                    {editingGroup ? 'Сохранить' : 'Создать'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                <GroupMembersModal
                    groupId={membersGroup ? membersGroup.id : null}
                    groupName={membersGroup ? membersGroup.name : undefined}
                    open={isMembersModalOpen}
                    onOpenChange={(open) => {
                        setIsMembersModalOpen(open);
                        if (!open) setMembersGroup(null);
                    }}
                    onSaved={() => fetchGroups()}
                />
            </div>
        </AppLayout>
    );
}
