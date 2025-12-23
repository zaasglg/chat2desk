import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { BreadcrumbItem, Tag } from '@/types';
import { ArrowLeft, Search, Image as ImageIcon, X, Calendar, MessageSquare, Users, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
    channels: { id: number; name: string; type: string }[];
    tags: Tag[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Рассылки', href: '/broadcasts/create' },
];

export default function BroadcastCreate({ channels, tags }: Props) {
    const { data, setData, post, processing } = useForm({
        content: '',
        channel_id: '',
        has_tag_ids: [] as number[],
        not_has_tag_ids: [] as number[],
        date_from: '',
        date_to: '',
        image: null as File | null,
    });
    const [result, setResult] = useState<string | null>(null);
    const [hasTagSearch, setHasTagSearch] = useState('');
    const [notHasTagSearch, setNotHasTagSearch] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Stats for preview
    const [chatCount, setChatCount] = useState<number | null>(null);
    const [messageCount, setMessageCount] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);

    // Fetch count when filters change
    const fetchCount = useCallback(async () => {
        // Only fetch if at least one filter is set
        if (!data.has_tag_ids.length && !data.not_has_tag_ids.length && !data.date_from && !data.date_to && !data.channel_id) {
            setChatCount(null);
            setMessageCount(null);
            return;
        }

        setCounting(true);
        try {
            const response = await fetch('/broadcasts/count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    channel_id: data.channel_id || null,
                    has_tag_ids: data.has_tag_ids,
                    not_has_tag_ids: data.not_has_tag_ids,
                    date_from: data.date_from || null,
                    date_to: data.date_to || null,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                setChatCount(result.chat_count);
                setMessageCount(result.message_count);
            }
        } catch (error) {
            console.error('Failed to fetch count:', error);
        } finally {
            setCounting(false);
        }
    }, [data.channel_id, data.has_tag_ids, data.not_has_tag_ids, data.date_from, data.date_to]);

    // Debounced effect for fetching count
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchCount();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [fetchCount]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/broadcasts', {
            onSuccess: () => {
                setResult('Рассылка отправлена');
                setImagePreview(null);
            },
        });
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) {
                setData('image', file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                alert('Пожалуйста, выберите изображение');
            }
        }
    };

    const removeImage = () => {
        setData('image', null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Создать рассылку" />

            <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Новая рассылка</h1>
                    <Button variant="ghost" size="icon" asChild>
                        <a href="/">
                            <ArrowLeft className="h-4 w-4" />
                        </a>
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                    <div>
                        <label className="text-sm text-muted-foreground">Канал (опционально)</label>
                        <select
                            value={data.channel_id}
                            onChange={(e) => setData('channel_id', e.target.value)}
                            className="mt-1 block w-full rounded border px-3 py-2"
                        >
                            <option value="">Все каналы</option>
                            {channels.map((ch) => (
                                <option key={ch.id} value={String(ch.id)}>{ch.name} ({ch.type})</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Filter */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Дата с
                            </label>
                            <Input
                                type="date"
                                value={data.date_from}
                                onChange={(e) => setData('date_from', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Дата по
                            </label>
                            <Input
                                type="date"
                                value={data.date_to}
                                onChange={(e) => setData('date_to', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Stats Preview */}
                    {(chatCount !== null || counting) && (
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="flex items-center gap-6">
                                {counting ? (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Подсчёт...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-blue-500" />
                                            <div>
                                                <span className="text-2xl font-bold">{chatCount?.toLocaleString()}</span>
                                                <span className="text-sm text-muted-foreground ml-2">чатов</span>
                                            </div>
                                        </div>
                                        {messageCount !== null && messageCount > 0 && (
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="h-5 w-5 text-green-500" />
                                                <div>
                                                    <span className="text-2xl font-bold">{messageCount?.toLocaleString()}</span>
                                                    <span className="text-sm text-muted-foreground ml-2">сообщений за период</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Рассылка будет отправлена на {chatCount?.toLocaleString()} чатов
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Имеет теги</label>
                        <div className="border rounded-md p-3 max-h-60 overflow-auto">
                            <div className="mb-2 sticky top-0 bg-background">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Поиск тегов..."
                                        value={hasTagSearch}
                                        onChange={(e) => setHasTagSearch(e.target.value)}
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                            </div>
                            {tags.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    Нет доступных тегов
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {tags
                                        .filter(tag => tag.name.toLowerCase().includes(hasTagSearch.toLowerCase()))
                                        .map((tag) => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                                            >
                                                <Checkbox
                                                    checked={data.has_tag_ids.includes(tag.id)}
                                                    onCheckedChange={() => toggleHasTag(tag.id)}
                                                />
                                                <Badge
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                    onClick={() => toggleHasTag(tag.id)}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            </div>
                                        ))}
                                    {hasTagSearch && tags.filter(tag => tag.name.toLowerCase().includes(hasTagSearch.toLowerCase())).length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            Ничего не найдено
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Не имеет теги</label>
                        <div className="border rounded-md p-3 max-h-60 overflow-auto">
                            <div className="mb-2 sticky top-0 bg-background">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Поиск тегов..."
                                        value={notHasTagSearch}
                                        onChange={(e) => setNotHasTagSearch(e.target.value)}
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                            </div>
                            {tags.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    Нет доступных тегов
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {tags
                                        .filter(tag => tag.name.toLowerCase().includes(notHasTagSearch.toLowerCase()))
                                        .map((tag) => (
                                            <div
                                                key={tag.id}
                                                className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                                            >
                                                <Checkbox
                                                    checked={data.not_has_tag_ids.includes(tag.id)}
                                                    onCheckedChange={() => toggleNotHasTag(tag.id)}
                                                />
                                                <Badge
                                                    variant="secondary"
                                                    className="cursor-pointer"
                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                    onClick={() => toggleNotHasTag(tag.id)}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            </div>
                                        ))}
                                    {notHasTagSearch && tags.filter(tag => tag.name.toLowerCase().includes(notHasTagSearch.toLowerCase())).length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            Ничего не найдено
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Изображение (опционально)</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        {imagePreview ? (
                            <div className="relative inline-block">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="max-w-xs max-h-48 rounded border"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto"
                            >
                                <ImageIcon className="h-4 w-4 mr-2" />
                                Выбрать изображение
                            </Button>
                        )}
                    </div>

                    <div>
                        <label className="text-sm text-muted-foreground">Текст рассылки</label>
                        <Textarea
                            value={data.content}
                            onChange={(e) => setData('content', e.target.value)}
                            rows={6}
                            placeholder="Введите сообщение для рассылки"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button type="submit" disabled={processing || (chatCount !== null && chatCount === 0)}>
                            {processing ? 'Отправка...' : `Отправить рассылку${chatCount !== null ? ` (${chatCount} чатов)` : ''}`}
                        </Button>
                        {result && <span className="text-sm text-green-600">{result}</span>}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
