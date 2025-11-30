import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel, type Tag } from '@/types';
import { Head, router } from '@inertiajs/react';
import { FileUpload } from '@/components/FileUpload';
import {
    ArrowLeft,
    Clock,
    FileText,
    Image,
    MessageSquare,
    Plus,
    Save,
    Tag as TagIcon,
    Trash2,
    User,
    Video,
    XCircle,
    GitBranch,
    GripVertical,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
    channels: Channel[];
    tags: Tag[];
}

type StepType = 'send_text' | 'send_image' | 'send_video' | 'send_file' | 'delay' | 'condition' | 'assign_operator' | 'add_tag' | 'remove_tag' | 'close_chat';

interface StepConfig {
    text?: string;
    url?: string;
    filename?: string;
    delay_seconds?: number;
    condition_type?: string;
    condition_value?: string;
    tag_id?: number;
    tag_name?: string;
}

interface Step {
    id: string;
    type: StepType;
    config: StepConfig;
}

const stepTypes: { type: StepType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'send_text', label: 'Отправить текст', icon: <MessageSquare className="h-4 w-4" />, color: '#22c55e' },
    { type: 'send_image', label: 'Отправить изображение', icon: <Image className="h-4 w-4" />, color: '#3b82f6' },
    { type: 'send_video', label: 'Отправить видео', icon: <Video className="h-4 w-4" />, color: '#8b5cf6' },
    { type: 'send_file', label: 'Отправить файл', icon: <FileText className="h-4 w-4" />, color: '#f59e0b' },
    { type: 'delay', label: 'Задержка', icon: <Clock className="h-4 w-4" />, color: '#6b7280' },
    { type: 'condition', label: 'Условие', icon: <GitBranch className="h-4 w-4" />, color: '#ec4899' },
    { type: 'add_tag', label: 'Добавить тег', icon: <TagIcon className="h-4 w-4" />, color: '#14b8a6' },
    { type: 'assign_operator', label: 'Назначить оператора', icon: <User className="h-4 w-4" />, color: '#f97316' },
    { type: 'close_chat', label: 'Закрыть чат', icon: <XCircle className="h-4 w-4" />, color: '#ef4444' },
];

export default function AutomationsCreate({ channels, tags }: Props) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [channelId, setChannelId] = useState<string>('');
    const [trigger, setTrigger] = useState<string>('new_chat');
    const [triggerKeywords, setTriggerKeywords] = useState('');
    const [triggerTagId, setTriggerTagId] = useState<string>('');
    const [isActive, setIsActive] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Автоматизации', href: '/automations' },
        { title: 'Создание', href: '/automations/create' },
    ];

    const selectedStep = steps.find(s => s.id === selectedStepId);

    const addStep = (type: StepType) => {
        const newStep: Step = {
            id: `step-${Date.now()}`,
            type,
            config: type === 'delay' ? { delay_seconds: 5 } : {},
        };
        setSteps([...steps, newStep]);
        setSelectedStepId(newStep.id);
    };

    const updateStepConfig = (stepId: string, key: string, value: unknown) => {
        setSteps(steps.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    config: { ...step.config, [key]: value },
                };
            }
            return step;
        }));
    };

    const updateStepConfigMultiple = (stepId: string, updates: Record<string, unknown>) => {
        setSteps(steps.map(step => {
            if (step.id === stepId) {
                return {
                    ...step,
                    config: { ...step.config, ...updates },
                };
            }
            return step;
        }));
    };


    const deleteStep = (stepId: string) => {
        setSteps(steps.filter(s => s.id !== stepId));
        if (selectedStepId === stepId) {
            setSelectedStepId(null);
        }
    };

    const moveStep = (stepId: string, direction: 'up' | 'down') => {
        const index = steps.findIndex(s => s.id === stepId);
        if (direction === 'up' && index > 0) {
            const newSteps = [...steps];
            [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
            setSteps(newSteps);
        } else if (direction === 'down' && index < steps.length - 1) {
            const newSteps = [...steps];
            [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
            setSteps(newSteps);
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert('Введите название автоматизации');
            return;
        }
        if (steps.length === 0) {
            alert('Добавьте хотя бы один шаг');
            return;
        }

        setSaving(true);

        router.post('/automations', {
            name,
            description,
            channel_id: channelId || null,
            trigger,
            trigger_config:
                trigger === 'keyword' ? { keywords: triggerKeywords } :
                    (trigger === 'tag_added' || trigger === 'tag_removed') ? { tag_id: parseInt(triggerTagId) } :
                        null,
            is_active: isActive,
            steps: steps.map((step, index) => ({
                step_id: step.id,
                type: step.type,
                config: step.config,
                position: { x: 250, y: index * 150 },
                next_step_id: steps[index + 1]?.id || null,
            })) as any,
        }, {
            onFinish: () => setSaving(false),
        });
    };

    const getStepType = (type: StepType) => stepTypes.find(s => s.type === type);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Создание автоматизации" />

            <div className="absolute inset-0 top-16 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b p-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <a href="/automations">
                                <ArrowLeft className="h-5 w-5" />
                            </a>
                        </Button>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Название автоматизации"
                            className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 w-64"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                            <span className="text-sm">Активна</span>
                        </div>
                        <Button onClick={handleSave} disabled={saving}>
                            <Save className="mr-2 h-4 w-4" />
                            {saving ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Step Types */}
                    <div className="w-64 border-r overflow-y-auto flex-shrink-0">
                        <div className="p-4">
                            <h3 className="font-medium mb-4">Добавить блок</h3>
                            <div className="space-y-2">
                                {stepTypes.map((step) => (
                                    <button
                                        key={step.type}
                                        onClick={() => addStep(step.type)}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-accent text-left transition-colors"
                                    >
                                        <div
                                            className="p-1.5 rounded text-white"
                                            style={{ backgroundColor: step.color }}
                                        >
                                            {step.icon}
                                        </div>
                                        <span className="text-sm">{step.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t">
                                <h3 className="font-medium mb-4">Настройки</h3>

                                <div className="space-y-4">
                                    <div>
                                        <Label>Триггер</Label>
                                        <Select value={trigger} onValueChange={setTrigger}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new_chat">Новый чат</SelectItem>
                                                <SelectItem value="keyword">Ключевое слово</SelectItem>
                                                <SelectItem value="no_response">Нет ответа</SelectItem>
                                                <SelectItem value="tag_added">Тег добавлен</SelectItem>
                                                <SelectItem value="tag_removed">Тег удален</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(trigger === 'tag_added' || trigger === 'tag_removed') && (
                                        <div>
                                            <Label>Выберите тег</Label>
                                            <Select value={triggerTagId} onValueChange={setTriggerTagId}>
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue placeholder="Выберите тег" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tags.map((tag) => (
                                                        <SelectItem key={tag.id} value={tag.id.toString()}>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                                {tag.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {trigger === 'keyword' && (
                                        <div>
                                            <Label>Ключевые слова</Label>
                                            <Input
                                                className="mt-1"
                                                placeholder="привет, старт, начать"
                                                value={triggerKeywords}
                                                onChange={(e) => setTriggerKeywords(e.target.value)}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <Label>Канал</Label>
                                        <Select value={channelId || 'all'} onValueChange={(val) => setChannelId(val === 'all' ? '' : val)}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Все каналы" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Все каналы</SelectItem>
                                                {channels.map((channel) => (
                                                    <SelectItem key={channel.id} value={channel.id.toString()}>
                                                        {channel.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Описание</Label>
                                        <Textarea
                                            className="mt-1"
                                            placeholder="Описание автоматизации..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center - Steps Flow */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">

                        {/* Scrollable Steps */}
                        <div className="flex-1 overflow-y-auto p-6 pt-0">
                            <div className="max-w-md mx-auto space-y-4">

                                {/* Fixed Start Node */}
                                <div className="p-6 pb-0 flex-shrink-0">
                                    <div className="max-w-md mx-auto">
                                        <div className="flex justify-center">
                                            <div className="bg-green-500 text-white px-6 py-2 rounded-full font-medium shadow-lg">
                                                Начало
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {steps.length > 0 && (
                                    <div className="flex justify-center pt-4">
                                        <div className="w-0.5 h-8 bg-border" />
                                    </div>
                                )}

                                {/* Steps */}
                                {steps.map((step, index) => {
                                    const stepType = getStepType(step.type);
                                    return (
                                        <div key={step.id}>
                                            <Card
                                                className={`!py-0 cursor-pointer transition-all ${selectedStepId === step.id ? 'ring-2 ring-primary' : ''}`}
                                                onClick={() => setSelectedStepId(step.id)}
                                            >
                                                <div
                                                    className="px-4 py-4 rounded-t-lg flex items-center gap-2 text-white text-sm font-medium"
                                                    style={{ backgroundColor: stepType?.color || '#6b7280' }}
                                                >
                                                    <GripVertical className="h-4 w-4 opacity-50" />
                                                    {stepType?.icon}
                                                    <span className="flex-1">{stepType?.label}</span>
                                                    <span className="text-xs opacity-75">#{index + 1}</span>
                                                </div>
                                                <CardContent className="p-3">
                                                    {step.type === 'send_text' && (
                                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                                            {step.config.text || 'Введите текст сообщения...'}
                                                        </p>
                                                    )}
                                                    {step.type === 'delay' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Переход через {step.config.delay_seconds || 0} сек.
                                                        </p>
                                                    )}
                                                    {step.type === 'send_image' && (
                                                        <div className="space-y-2">
                                                            {step.config.url ? (
                                                                <img
                                                                    src={step.config.url.startsWith('http') || step.config.url.startsWith('/') ? step.config.url : `/storage/${step.config.url}`}
                                                                    alt="Preview"
                                                                    className="w-full h-32 object-cover rounded-md"
                                                                />
                                                            ) : (
                                                                <p className="text-sm text-muted-foreground">Добавьте изображение</p>
                                                            )}
                                                            {step.config.text && (
                                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                                    {step.config.text}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {step.type === 'send_video' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.url ? 'Видео добавлено' : 'Добавьте видео'}
                                                        </p>
                                                    )}
                                                    {step.type === 'send_file' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.url ? 'Файл добавлен' : 'Добавьте файл'}
                                                        </p>
                                                    )}
                                                    {step.type === 'add_tag' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.tag_name || 'Выберите тег...'}
                                                        </p>
                                                    )}
                                                    {step.type === 'condition' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.condition_type || 'Настройте условие...'}
                                                        </p>
                                                    )}
                                                    {step.type === 'close_chat' && (
                                                        <p className="text-sm text-muted-foreground">Закрывает чат</p>
                                                    )}
                                                    {step.type === 'assign_operator' && (
                                                        <p className="text-sm text-muted-foreground">Назначает оператора</p>
                                                    )}
                                                </CardContent>
                                            </Card>

                                            {/* Connection Line */}
                                            {index < steps.length - 1 && (
                                                <div className="flex justify-center pt-4">
                                                    <div className="w-0.5 h-8 bg-border" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Add Step Button */}
                                <div className="flex justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => addStep('send_text')}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Добавить блок
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar - Step Config */}
                    {selectedStep && (
                        <div className="w-80 border-l overflow-y-auto flex-shrink-0">
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-medium">Настройки блока</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedStepId(null)}
                                    >
                                        ✕
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {selectedStep.type === 'send_text' && (
                                        <div>
                                            <Label>Текст сообщения</Label>
                                            <Textarea
                                                className="mt-1"
                                                placeholder="Введите текст..."
                                                value={selectedStep.config.text || ''}
                                                onChange={(e) => updateStepConfig(selectedStep.id, 'text', e.target.value)}
                                                rows={5}
                                            />
                                        </div>
                                    )}

                                    {selectedStep.type === 'send_image' && (
                                        <div>
                                            <Label>Изображение</Label>
                                            <FileUpload
                                                type="image"
                                                value={selectedStep.config.url || ''}
                                                onChange={(url, filename) => {
                                                    updateStepConfigMultiple(selectedStep.id, {
                                                        url,
                                                        filename: filename || ''
                                                    });
                                                }}
                                                onDelete={() => {
                                                    updateStepConfig(selectedStep.id, 'url', '');
                                                    updateStepConfig(selectedStep.id, 'filename', '');
                                                }}
                                            />
                                            <div className="mt-3">
                                                <Label>Подпись к изображению</Label>
                                                <Textarea
                                                    className="mt-1"
                                                    placeholder="Введите подпись..."
                                                    value={selectedStep.config.text || ''}
                                                    onChange={(e) => updateStepConfig(selectedStep.id, 'text', e.target.value)}
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedStep.type === 'send_video' && (
                                        <div>
                                            <Label>Видео</Label>
                                            <FileUpload
                                                type="video"
                                                value={selectedStep.config.url || ''}
                                                onChange={(url, filename) => {
                                                    updateStepConfigMultiple(selectedStep.id, {
                                                        url,
                                                        filename: filename || ''
                                                    });
                                                }}
                                                onDelete={() => {
                                                    updateStepConfig(selectedStep.id, 'url', '');
                                                    updateStepConfig(selectedStep.id, 'filename', '');
                                                }}
                                            />
                                            <div className="mt-3">
                                                <Label>Подпись к видео</Label>
                                                <Textarea
                                                    className="mt-1"
                                                    placeholder="Введите подпись..."
                                                    value={selectedStep.config.text || ''}
                                                    onChange={(e) => updateStepConfig(selectedStep.id, 'text', e.target.value)}
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedStep.type === 'send_file' && (
                                        <div>
                                            <Label>Файл</Label>
                                            <FileUpload
                                                type="document"
                                                value={selectedStep.config.url || ''}
                                                onChange={(url, filename) => {
                                                    updateStepConfigMultiple(selectedStep.id, {
                                                        url,
                                                        filename: filename || ''
                                                    });
                                                }}
                                                onDelete={() => {
                                                    updateStepConfig(selectedStep.id, 'url', '');
                                                    updateStepConfig(selectedStep.id, 'filename', '');
                                                }}
                                            />
                                            <div className="mt-3">
                                                <Label>Подпись к файлу</Label>
                                                <Textarea
                                                    className="mt-1"
                                                    placeholder="Введите подпись..."
                                                    value={selectedStep.config.text || ''}
                                                    onChange={(e) => updateStepConfig(selectedStep.id, 'text', e.target.value)}
                                                    rows={3}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedStep.type === 'delay' && (
                                        <div>
                                            <Label>Задержка (секунды)</Label>
                                            <Input
                                                className="mt-1"
                                                type="number"
                                                min={1}
                                                value={selectedStep.config.delay_seconds || 5}
                                                onChange={(e) => updateStepConfig(selectedStep.id, 'delay_seconds', parseInt(e.target.value))}
                                            />
                                        </div>
                                    )}

                                    {selectedStep.type === 'add_tag' && (
                                        <div>
                                            <Label>Тег</Label>
                                            <Select
                                                value={selectedStep.config.tag_id?.toString() || ''}
                                                onValueChange={(v) => {
                                                    const tag = tags.find(t => t.id.toString() === v);
                                                    updateStepConfig(selectedStep.id, 'tag_id', parseInt(v));
                                                    updateStepConfig(selectedStep.id, 'tag_name', tag?.name || '');
                                                }}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue placeholder="Выберите тег" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tags.map((tag) => (
                                                        <SelectItem key={tag.id} value={tag.id.toString()}>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                                {tag.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {selectedStep.type === 'condition' && (
                                        <>
                                            <div>
                                                <Label>Тип условия</Label>
                                                <Select
                                                    value={selectedStep.config.condition_type || ''}
                                                    onValueChange={(v) => updateStepConfig(selectedStep.id, 'condition_type', v)}
                                                >
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue placeholder="Выберите условие" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="has_tag">Есть тег</SelectItem>
                                                        <SelectItem value="message_contains">Сообщение содержит</SelectItem>
                                                        <SelectItem value="is_new_client">Новый клиент</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {selectedStep.config.condition_type === 'has_tag' ? (
                                                <div>
                                                    <Label>Выберите тег</Label>
                                                    <Select
                                                        value={selectedStep.config.condition_value || ''}
                                                        onValueChange={(v) => updateStepConfig(selectedStep.id, 'condition_value', v)}
                                                    >
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Выберите тег" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {tags.map((tag) => (
                                                                <SelectItem key={tag.id} value={tag.id.toString()}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div
                                                                            className="w-3 h-3 rounded-full"
                                                                            style={{ backgroundColor: tag.color }}
                                                                        />
                                                                        {tag.name}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Label>Значение</Label>
                                                    <Input
                                                        className="mt-1"
                                                        placeholder="Значение для проверки..."
                                                        value={selectedStep.config.condition_value || ''}
                                                        onChange={(e) => updateStepConfig(selectedStep.id, 'condition_value', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => moveStep(selectedStep.id, 'up')}
                                            disabled={steps.findIndex(s => s.id === selectedStep.id) === 0}
                                        >
                                            ↑ Вверх
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => moveStep(selectedStep.id, 'down')}
                                            disabled={steps.findIndex(s => s.id === selectedStep.id) === steps.length - 1}
                                        >
                                            ↓ Вниз
                                        </Button>
                                    </div>

                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        onClick={() => deleteStep(selectedStep.id)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Удалить блок
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}