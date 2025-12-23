import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel, type Tag, type User } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { CalendarIcon, Tag as TagIcon, Search, FileSpreadsheet, X } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
    channels: Channel[];
    tags: Tag[];
    operators: User[];
    countResult?: {
        total: number;
        matched: number;
        tagStats?: Array<{
            id: number;
            name: string;
            color: string;
            clients_count: number;
        }>;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Аналитика', href: '/analytics' },
];

const clientInfoFields = [
    { value: 'name', label: 'Имя клиента' },
    { value: 'phone', label: 'Телефон' },
    { value: 'email', label: 'Email' },
    { value: 'notes', label: 'Комментарий' },
    { value: 'id', label: 'ID клиента' },
];

export default function AnalyticsIndex({ channels, tags, operators, countResult }: Props) {
    const [hasTagSearch, setHasTagSearch] = useState('');
    const [notHasTagSearch, setNotHasTagSearch] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    const { data, setData, post, processing } = useForm({
        // Tags
        enableTags: true,
        has_tag_ids: [] as number[],
        enableNotTags: true,
        not_has_tag_ids: [] as number[],
        
        // Client info
        enableClientInfo: true,
        client_info_field: 'name' as string,
        client_info_text: '' as string,
        
        // Messenger
        enableMessenger: true,
        messenger_type: '' as string,
        
        // Channel
        enableChannel: true,
        channel_id: '' as string,
        
        // First message date
        enableFirstMessage: true,
        first_message_from: '' as string,
        first_message_to: '' as string,
        
        // Operators
        enableOperators: true,
        operator_ids: [] as number[],
        
        // Limit
        enableLimit: true,
        limit_quantity: '' as string,
        
        // Exclude active chats
        exclude_active_chats: false,
    });

    const toggleHasTag = (tagId: number) => {
        const newTagIds = data.has_tag_ids.includes(tagId)
            ? data.has_tag_ids.filter(id => id !== tagId)
            : [...data.has_tag_ids, tagId];
        setData('has_tag_ids', newTagIds);
    };

    const toggleNotHasTag = (tagId: number) => {
        const newTagIds = data.not_has_tag_ids.includes(tagId)
            ? data.not_has_tag_ids.filter(id => id !== tagId)
            : [...data.not_has_tag_ids, tagId];
        setData('not_has_tag_ids', newTagIds);
    };

    const toggleOperator = (operatorId: number) => {
        const newOperatorIds = data.operator_ids.includes(operatorId)
            ? data.operator_ids.filter(id => id !== operatorId)
            : [...data.operator_ids, operatorId];
        setData('operator_ids', newOperatorIds);
    };

    const handleCalculate = () => {
        // Prepare data with dates
        const formData = {
            ...data,
            first_message_from: startDate ? format(startDate, 'yyyy-MM-dd') : '',
            first_message_to: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        };
        
        router.post('/analytics/calculate', formData, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleExport = () => {
        const formData: any = { ...data };
        
        if (startDate) {
            formData.first_message_from = format(startDate, 'yyyy-MM-dd');
        } else {
            formData.first_message_from = '';
        }
        if (endDate) {
            formData.first_message_to = format(endDate, 'yyyy-MM-dd');
        } else {
            formData.first_message_to = '';
        }
        
        router.post('/analytics/export', formData);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Аналитика" />
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Аналитика</h1>

                <div className="space-y-6">
                    {/* Tags Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableTags}
                                    onCheckedChange={(checked) => setData('enableTags', checked as boolean)}
                                />
                                <CardTitle>Теги</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <CardDescription className="mb-2">
                                    Укажите теги, все из которых клиент или запрос должен иметь для получения сообщения.
                                </CardDescription>
                                <div className="relative">
                                    <TagIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Теги клиента"
                                        value={hasTagSearch}
                                        onChange={(e) => setHasTagSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                    {tags
                                        .filter(tag => tag.name.toLowerCase().includes(hasTagSearch.toLowerCase()))
                                        .map((tag) => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                                                onClick={() => toggleHasTag(tag.id)}
                                            >
                                                <Checkbox 
                                                    checked={data.has_tag_ids.includes(tag.id)}
                                                    onCheckedChange={() => toggleHasTag(tag.id)}
                                                />
                                                <Badge
                                                    variant="secondary"
                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            <div>
                                <CardDescription className="mb-2">
                                    Укажите теги, любое из которых клиент или запрос не должен иметь для получения сообщения.
                                </CardDescription>
                                <div className="relative">
                                    <TagIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Исключить эти теги"
                                        value={notHasTagSearch}
                                        onChange={(e) => setNotHasTagSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                    {tags
                                        .filter(tag => tag.name.toLowerCase().includes(notHasTagSearch.toLowerCase()))
                                        .map((tag) => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                                                onClick={() => toggleNotHasTag(tag.id)}
                                            >
                                                <Checkbox 
                                                    checked={data.not_has_tag_ids.includes(tag.id)}
                                                    onCheckedChange={() => toggleNotHasTag(tag.id)}
                                                />
                                                <Badge
                                                    variant="secondary"
                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Client Info Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableClientInfo}
                                    onCheckedChange={(checked) => setData('enableClientInfo', checked as boolean)}
                                />
                                <CardTitle>Текст в карточке клиента, имя, телефон (id) или комментарий</CardTitle>
                            </div>
                            <CardDescription>
                                Выберите поле и текст для поиска (частичное вхождение, регистр букв не учитывается)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Select
                                    value={data.client_info_field}
                                    onValueChange={(value) => setData('client_info_field', value)}
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientInfoFields.map((field) => (
                                            <SelectItem key={field.value} value={field.value}>
                                                {field.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Текст"
                                    value={data.client_info_text}
                                    onChange={(e) => setData('client_info_text', e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Messenger Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableMessenger}
                                    onCheckedChange={(checked) => setData('enableMessenger', checked as boolean)}
                                />
                                <CardTitle>Мессенджер клиента</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={data.messenger_type}
                                onValueChange={(value) => setData('messenger_type', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Мессенджеры" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="telegram">Telegram</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="vk">VK</SelectItem>
                                    <SelectItem value="viber">Viber</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Channel Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableChannel}
                                    onCheckedChange={(checked) => setData('enableChannel', checked as boolean)}
                                />
                                <CardTitle>Канал (аккаунт)</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={data.channel_id}
                                onValueChange={(value) => setData('channel_id', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Канал (аккаунт)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {channels.map((channel) => (
                                        <SelectItem key={channel.id} value={channel.id.toString()}>
                                            {channel.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* First Message Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableFirstMessage}
                                    onCheckedChange={(checked) => setData('enableFirstMessage', checked as boolean)}
                                />
                                <CardTitle>Первое сообщение от клиента</CardTitle>
                            </div>
                            <CardDescription>
                                Чат с клиентом начался с...
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-[240px] justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, 'dd-MM-yyyy', { locale: ru }) : '01-01-2025'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <span>...до</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-[240px] justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, 'dd-MM-yyyy', { locale: ru }) : '23-12-2025'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operators Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableOperators}
                                    onCheckedChange={(checked) => setData('enableOperators', checked as boolean)}
                                />
                                <CardTitle>Операторы чатов</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                                {operators.map((operator) => (
                                    <div
                                        key={operator.id}
                                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer rounded"
                                        onClick={() => toggleOperator(operator.id)}
                                    >
                                        <Checkbox 
                                            checked={data.operator_ids.includes(operator.id)}
                                            onCheckedChange={() => toggleOperator(operator.id)}
                                        />
                                        <span>{operator.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Limit Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.enableLimit}
                                    onCheckedChange={(checked) => setData('enableLimit', checked as boolean)}
                                />
                                <CardTitle>Лимит количества</CardTitle>
                            </div>
                            <CardDescription>
                                Ограничить количество в рассылке не более указанного числа получателей. 0 или пусто означает без ограничений.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                type="number"
                                placeholder="Лимит количества"
                                value={data.limit_quantity}
                                onChange={(e) => setData('limit_quantity', e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    {/* Exclude Active Chats */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={data.exclude_active_chats}
                                    onCheckedChange={(checked) => setData('exclude_active_chats', checked as boolean)}
                                />
                                <CardTitle>Не отправлять в открытые (активные) чаты</CardTitle>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Counting Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Подсчет</CardTitle>
                            <CardDescription>
                                Подсчитайте количество клиентов, которые входят в выборку в соответствии с условиями выше.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleCalculate} disabled={processing}>
                                Рассчитать
                            </Button>
                            {countResult && (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm">
                                            В выборку вошло {countResult.matched} из {countResult.total} человек.
                                        </p>
                                    </div>
                                    
                                    {/* Tag Statistics */}
                                    {countResult.tagStats && countResult.tagStats.length > 0 && (
                                        <div>
                                            <Label className="text-sm font-medium mb-2 block">Распределение по тегам:</Label>
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {countResult.tagStats.map((tagStat) => (
                                                    <div key={tagStat.id} className="flex items-center justify-between p-2 rounded border">
                                                        <div className="flex items-center gap-2">
                                                            <Badge
                                                                variant="secondary"
                                                                style={{ backgroundColor: tagStat.color + '20', color: tagStat.color }}
                                                            >
                                                                {tagStat.name}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-sm font-medium">
                                                            {tagStat.clients_count} {tagStat.clients_count === 1 ? 'клиент' : tagStat.clients_count < 5 ? 'клиента' : 'клиентов'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <Button onClick={handleExport} variant="outline" className="gap-2 w-full">
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Экспортировать список
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
