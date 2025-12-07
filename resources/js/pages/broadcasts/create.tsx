import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { BreadcrumbItem } from '@/types';
import { ArrowLeft, Upload, X, AlertTriangle } from 'lucide-react';
import { useState, useRef } from 'react';
import { type Channel, type Tag, type User } from '@/types';

interface Props {
    channels: { id: number; name: string; type: string }[];
    tags: Tag[];
    operators: User[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Рассылки', href: '/broadcasts/create' },
];

export default function BroadcastCreate({ channels, tags, operators }: Props) {
    const [filters, setFilters] = useState({
        tags: false,
        client_text: false,
        channel_type: false,
        channel_id: false,
        first_message: false,
        operator: false,
        limit: false,
        exclude_open_chats: false,
    });

    const [filterValues, setFilterValues] = useState({
        tag_ids: [] as number[],
        client_text: '',
        channel_type: '',
        channel_id: '',
        first_message_text: '',
        operator_id: '',
        limit: '',
        exclude_open_chats: false,
    });

    const [massOperations, setMassOperations] = useState({
        tags: false,
        mark_read: false,
        assign_operator: false,
        close_chats: false,
    });

    const [massOperationValues, setMassOperationValues] = useState({
        tag_ids: [] as number[],
        tag_action: 'add' as 'add' | 'remove',
        operator_id: '',
    });

    const [clientCount, setClientCount] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing } = useForm({
        content: '',
        filters: {},
        mass_operations: {},
        is_scheduled: false,
        schedule_type: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
        schedule_config: {} as { days?: number[]; time?: string; day?: number },
        scheduled_at: '',
        name: '',
    });

    const handleCount = async () => {
        setCounting(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/broadcasts/count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ filters: buildFilters() }),
            });
            const result = await response.json();
            setClientCount(result.count);
        } catch (error) {
            console.error('Error counting clients:', error);
        } finally {
            setCounting(false);
        }
    };

    const buildFilters = () => {
        const result: any = {};
        if (filters.tags && filterValues.tag_ids.length > 0) {
            result.tag_ids = filterValues.tag_ids;
        }
        if (filters.client_text && filterValues.client_text) {
            result.client_text = filterValues.client_text;
        }
        if (filters.channel_type && filterValues.channel_type) {
            result.channel_type = filterValues.channel_type;
        }
        if (filters.channel_id && filterValues.channel_id) {
            result.channel_id = filterValues.channel_id;
        }
        if (filters.first_message && filterValues.first_message_text) {
            result.first_message_text = filterValues.first_message_text;
        }
        if (filters.operator && filterValues.operator_id) {
            result.operator_id = filterValues.operator_id;
        }
        if (filters.limit && filterValues.limit) {
            result.limit = parseInt(filterValues.limit);
        }
        if (filters.exclude_open_chats) {
            result.exclude_open_chats = filterValues.exclude_open_chats;
        }
        return result;
    };

    const buildMassOperations = () => {
        const result: any = {};
        if (massOperations.tags && massOperationValues.tag_ids.length > 0) {
            result.tags = {
                tag_ids: massOperationValues.tag_ids,
                action: massOperationValues.tag_action,
            };
        }
        if (massOperations.mark_read) {
            result.mark_read = true;
        }
        if (massOperations.assign_operator && massOperationValues.operator_id) {
            result.assign_operator_id = parseInt(massOperationValues.operator_id);
        }
        if (massOperations.close_chats) {
            result.close_chats = true;
        }
        return result;
    };

    const clearAllFilters = () => {
        setFilters({
            tags: false,
            client_text: false,
            channel_type: false,
            channel_id: false,
            first_message: false,
            operator: false,
            limit: false,
            exclude_open_chats: false,
        });
        setFilterValues({
            tag_ids: [],
            client_text: '',
            channel_type: '',
            channel_id: '',
            first_message_text: '',
            operator_id: '',
            limit: '',
            exclude_open_chats: false,
        });
        setClientCount(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachment(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setAttachmentPreview(e.target?.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                setAttachmentPreview(null);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('content', data.content);
        formData.append('filters', JSON.stringify(buildFilters()));
        formData.append('mass_operations', JSON.stringify(buildMassOperations()));
        formData.append('is_scheduled', data.is_scheduled ? '1' : '0');
        formData.append('schedule_type', data.schedule_type);
        formData.append('schedule_config', JSON.stringify(data.schedule_config));
        if (data.scheduled_at) {
            formData.append('scheduled_at', data.scheduled_at);
        }
        if (data.name) {
            formData.append('name', data.name);
        }
        if (attachment) {
            formData.append('attachment', attachment);
        }

        router.post('/broadcasts', formData, {
            forceFormData: true,
            onSuccess: () => {
                // Reset form
                setData('content', '');
                setAttachment(null);
                setAttachmentPreview(null);
                clearAllFilters();
            },
        });
    };

    const toggleTag = (tagId: number) => {
        setFilterValues(prev => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter(id => id !== tagId)
                : [...prev.tag_ids, tagId],
        }));
    };

    const toggleMassTag = (tagId: number) => {
        setMassOperationValues(prev => ({
            ...prev,
            tag_ids: prev.tag_ids.includes(tagId)
                ? prev.tag_ids.filter(id => id !== tagId)
                : [...prev.tag_ids, tagId],
        }));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Рассылки и массовые операции" />

            <div className="p-6 max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Рассылки и массовые операции по текущим клиентам
                    </h1>
                    <p className="text-muted-foreground">
                        Здесь вы можете проводить рассылки и массовые операции по вашим существующим клиентам, то есть тем, кто уже писал вам ранее.
                    </p>
                    <div className="mt-4 flex gap-4 text-sm">
                        <a href="#" className="text-primary hover:underline">Журнал</a>
                        <a href="#" className="text-primary hover:underline">
                            Массовое создание клиентов и присвоение тегов
                        </a>
                    </div>
                </div>

                {/* Filters Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Выборка</CardTitle>
                                <CardDescription>
                                    Используйте фильтры для точного таргетирования ваших рассылок или массовых операций с клиентами и чатами.
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                                Очистить все фильтры
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Tags Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.tags}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, tags: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Теги</Label>
                                {filters.tags && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                                    filterValues.tag_ids.includes(tag.id)
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-background hover:bg-accent'
                                                }`}
                                                style={
                                                    filterValues.tag_ids.includes(tag.id)
                                                        ? {}
                                                        : { borderColor: tag.color }
                                                }
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Client Text Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.client_text}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, client_text: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">
                                    Текст в полях карточки клиента, в имени, телефоне (id) или в комментарии
                                </Label>
                                {filters.client_text && (
                                    <Input
                                        className="mt-2"
                                        placeholder="Введите текст для поиска"
                                        value={filterValues.client_text}
                                        onChange={(e) =>
                                            setFilterValues(prev => ({ ...prev, client_text: e.target.value }))
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        {/* Messenger Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.channel_type}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, channel_type: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Мессенджер клиента</Label>
                                {filters.channel_type && (
                                    <Select
                                        value={filterValues.channel_type}
                                        onValueChange={(value) =>
                                            setFilterValues(prev => ({ ...prev, channel_type: value }))
                                        }
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Выберите мессенджер" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="telegram">Telegram</SelectItem>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* Channel Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.channel_id}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, channel_id: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Канал (аккаунт)</Label>
                                {filters.channel_id && (
                                    <Select
                                        value={filterValues.channel_id}
                                        onValueChange={(value) =>
                                            setFilterValues(prev => ({ ...prev, channel_id: value }))
                                        }
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Выберите канал" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {channels.map(channel => (
                                                <SelectItem key={channel.id} value={channel.id.toString()}>
                                                    {channel.name} ({channel.type})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* First Message Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.first_message}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, first_message: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Первое сообщение от клиента</Label>
                                {filters.first_message && (
                                    <Input
                                        className="mt-2"
                                        placeholder="Введите текст первого сообщения"
                                        value={filterValues.first_message_text}
                                        onChange={(e) =>
                                            setFilterValues(prev => ({ ...prev, first_message_text: e.target.value }))
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        {/* Operator Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.operator}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, operator: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Оператор чата</Label>
                                {filters.operator && (
                                    <Select
                                        value={filterValues.operator_id}
                                        onValueChange={(value) =>
                                            setFilterValues(prev => ({ ...prev, operator_id: value }))
                                        }
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Выберите оператора" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {operators.map(operator => (
                                                <SelectItem key={operator.id} value={operator.id.toString()}>
                                                    {operator.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* Limit Filter */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.limit}
                                onCheckedChange={(checked) =>
                                    setFilters(prev => ({ ...prev, limit: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Ограничить количество</Label>
                                {filters.limit && (
                                    <Input
                                        type="number"
                                        className="mt-2"
                                        placeholder="Введите количество"
                                        value={filterValues.limit}
                                        onChange={(e) =>
                                            setFilterValues(prev => ({ ...prev, limit: e.target.value }))
                                        }
                                    />
                                )}
                            </div>
                        </div>

                        {/* Exclude Open Chats */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={filters.exclude_open_chats}
                                onCheckedChange={(checked) => {
                                    setFilters(prev => ({ ...prev, exclude_open_chats: checked as boolean }));
                                    setFilterValues(prev => ({ ...prev, exclude_open_chats: checked as boolean }));
                                }}
                            />
                            <div className="flex-1">
                                <Label className="font-normal">
                                    Не рассылать в открытые (активные) чаты
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Count Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Подсчет</CardTitle>
                        <CardDescription>
                            Посчитайте количество клиентов, попавших в выборку в соответствии с условиями выше.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleCount} disabled={counting}>
                            {counting ? 'Подсчет...' : 'Посчитать'}
                        </Button>
                        {clientCount !== null && (
                            <p className="mt-4 text-lg font-semibold">
                                Найдено клиентов: {clientCount}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Mass Operations Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Массовые операции над чатами</CardTitle>
                        <CardDescription>
                            Проводите массовые операции с чатами без рассылки или одновременно с проведением рассылки. Чтобы выполнить операцию без рассылки, используйте ссылку в каждом из подразделов ниже.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Tags Operation */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={massOperations.tags}
                                onCheckedChange={(checked) =>
                                    setMassOperations(prev => ({ ...prev, tags: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Присвоить или удалить теги</Label>
                                {massOperations.tags && (
                                    <div className="mt-2 space-y-2">
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={massOperationValues.tag_action === 'add' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setMassOperationValues(prev => ({ ...prev, tag_action: 'add' }))}
                                            >
                                                Добавить
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={massOperationValues.tag_action === 'remove' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setMassOperationValues(prev => ({ ...prev, tag_action: 'remove' }))}
                                            >
                                                Удалить
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map(tag => (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => toggleMassTag(tag.id)}
                                                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                                        massOperationValues.tag_ids.includes(tag.id)
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'bg-background hover:bg-accent'
                                                    }`}
                                                    style={
                                                        massOperationValues.tag_ids.includes(tag.id)
                                                            ? {}
                                                            : { borderColor: tag.color }
                                                    }
                                                >
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mark Read */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={massOperations.mark_read}
                                onCheckedChange={(checked) =>
                                    setMassOperations(prev => ({ ...prev, mark_read: checked as boolean }))
                                }
                            />
                            <Label className="font-normal">Пометить чаты "прочитанными"</Label>
                        </div>

                        {/* Assign Operator */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={massOperations.assign_operator}
                                onCheckedChange={(checked) =>
                                    setMassOperations(prev => ({ ...prev, assign_operator: checked as boolean }))
                                }
                            />
                            <div className="flex-1">
                                <Label className="font-normal">Перевести на оператора</Label>
                                {massOperations.assign_operator && (
                                    <Select
                                        value={massOperationValues.operator_id}
                                        onValueChange={(value) =>
                                            setMassOperationValues(prev => ({ ...prev, operator_id: value }))
                                        }
                                    >
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Выберите оператора" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {operators.map(operator => (
                                                <SelectItem key={operator.id} value={operator.id.toString()}>
                                                    {operator.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {/* Close Chats */}
                        <div className="flex items-start gap-3">
                            <Checkbox
                                checked={massOperations.close_chats}
                                onCheckedChange={(checked) =>
                                    setMassOperations(prev => ({ ...prev, close_chats: checked as boolean }))
                                }
                            />
                            <Label className="font-normal">Закрыть чаты</Label>
                        </div>
                    </CardContent>
                </Card>

                {/* Broadcast Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>РАССЫЛКА</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Warning */}
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-800">
                                        <strong>ВНИМАНИЕ!</strong> Не рассылайте одинаковый текст более 30 клиентам в WhatsApp за один раз. WhatsApp такое не любит и ваш номер может быть ЗАБАНЕН! Текст и приложенная картинка или PDF, указанные ниже, будут отправлены клиентам, попавшим в выборку.
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <Label>Текст</Label>
                                <Textarea
                                    className="mt-2"
                                    rows={8}
                                    placeholder="Введите текст рассылки"
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Используйте переменную %client (имя клиента, если известно).
                                </p>
                            </div>

                            {/* File Upload */}
                            <div>
                                <Label>Картинка или PDF</Label>
                                <div className="mt-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    {!attachment && (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-accent transition-colors"
                                        >
                                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">
                                                Выберите или перетащите сюда
                                            </p>
                                        </div>
                                    )}
                                    {attachment && (
                                        <div className="border rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {attachmentPreview && (
                                                    <img
                                                        src={attachmentPreview}
                                                        alt="Preview"
                                                        className="h-16 w-16 object-cover rounded"
                                                    />
                                                )}
                                                <div>
                                                    <p className="font-medium">{attachment.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {(attachment.size / 1024).toFixed(2)} KB
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setAttachment(null);
                                                    setAttachmentPreview(null);
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scheduling */}
                            <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Запланировать рассылку</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Включите, чтобы отправить рассылку позже или настроить повторяющуюся рассылку
                                        </p>
                                    </div>
                                    <Switch
                                        checked={data.is_scheduled}
                                        onCheckedChange={(checked) => setData('is_scheduled', checked)}
                                    />
                                </div>

                                {data.is_scheduled && (
                                    <div className="space-y-4 pl-4 border-l-2">
                                        <div>
                                            <Label>Название рассылки</Label>
                                            <Input
                                                className="mt-2"
                                                placeholder="Название для идентификации"
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <Label>Тип расписания</Label>
                                            <Select
                                                value={data.schedule_type}
                                                onValueChange={(value: 'once' | 'daily' | 'weekly' | 'monthly') => {
                                                    setData('schedule_type', value);
                                                    if (value === 'weekly') {
                                                        setData('schedule_config', { days: [1], time: '02:00' });
                                                    } else if (value === 'daily') {
                                                        setData('schedule_config', { time: '02:00' });
                                                    } else {
                                                        setData('schedule_config', {});
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="once">Один раз</SelectItem>
                                                    <SelectItem value="daily">Ежедневно</SelectItem>
                                                    <SelectItem value="weekly">Еженедельно</SelectItem>
                                                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {data.schedule_type === 'once' && (
                                            <div>
                                                <Label>Дата и время отправки</Label>
                                                <Input
                                                    type="datetime-local"
                                                    className="mt-2"
                                                    value={data.scheduled_at}
                                                    onChange={(e) => setData('scheduled_at', e.target.value)}
                                                />
                                            </div>
                                        )}

                                        {(data.schedule_type === 'daily' || data.schedule_type === 'weekly' || data.schedule_type === 'monthly') && (
                                            <div>
                                                <Label>Время отправки</Label>
                                                <Input
                                                    type="time"
                                                    className="mt-2"
                                                    value={data.schedule_config?.time || '02:00'}
                                                    onChange={(e) =>
                                                        setData('schedule_config', {
                                                            ...data.schedule_config,
                                                            time: e.target.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}

                                        {data.schedule_type === 'weekly' && (
                                            <div>
                                                <Label>Дни недели</Label>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {[
                                                        { value: 1, label: 'Понедельник' },
                                                        { value: 2, label: 'Вторник' },
                                                        { value: 3, label: 'Среда' },
                                                        { value: 4, label: 'Четверг' },
                                                        { value: 5, label: 'Пятница' },
                                                        { value: 6, label: 'Суббота' },
                                                        { value: 7, label: 'Воскресенье' },
                                                    ].map(day => (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentDays = data.schedule_config?.days || [];
                                                                const newDays = currentDays.includes(day.value)
                                                                    ? currentDays.filter((d: number) => d !== day.value)
                                                                    : [...currentDays, day.value];
                                                                setData('schedule_config', {
                                                                    ...data.schedule_config,
                                                                    days: newDays.sort(),
                                                                });
                                                            }}
                                                            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                                                data.schedule_config?.days?.includes(day.value)
                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                    : 'bg-background hover:bg-accent'
                                                            }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {data.schedule_type === 'monthly' && (
                                            <div>
                                                <Label>День месяца</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    className="mt-2"
                                                    value={data.schedule_config?.day || 1}
                                                    onChange={(e) =>
                                                        setData('schedule_config', {
                                                            ...data.schedule_config,
                                                            day: parseInt(e.target.value),
                                                        })
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end">
                                <Button type="submit" disabled={processing} size="lg">
                                    {processing ? 'Отправка...' : 'ОТПРАВИТЬ!'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
