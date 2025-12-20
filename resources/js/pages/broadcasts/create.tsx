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
import { ArrowLeft, Search, Image as ImageIcon, X } from 'lucide-react';
import { useState, useRef } from 'react';

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
        image: null as File | null,
    });
    const [result, setResult] = useState<string | null>(null);
    const [hasTagSearch, setHasTagSearch] = useState('');
    const [notHasTagSearch, setNotHasTagSearch] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

                    <div>                        <label className="text-sm text-muted-foreground mb-2 block">Изображение (опционально)</label>
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

                    <div>                        <label className="text-sm text-muted-foreground">Текст рассылки</label>
                        <Textarea
                            value={data.content}
                            onChange={(e) => setData('content', e.target.value)}
                            rows={6}
                            placeholder="Введите сообщение для рассылки"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button type="submit" disabled={processing}>{processing ? 'Отправка...' : 'Отправить рассылку'}</Button>
                        {result && <span className="text-sm text-green-600">{result}</span>}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
