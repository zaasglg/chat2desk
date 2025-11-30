import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { BreadcrumbItem } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface Props {
    channels: { id: number; name: string; type: string }[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Рассылки', href: '/broadcasts/create' },
];

export default function BroadcastCreate({ channels }: Props) {
    const { data, setData, post, processing } = useForm({
        content: '',
        channel_id: '',
    });
    const [result, setResult] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/broadcasts', {
            onSuccess: () => {
                setResult('Рассылка отправлена');
            },
        });
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
                        <label className="text-sm text-muted-foreground">Текст рассылки</label>
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
