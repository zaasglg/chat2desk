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
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Channel, type Tag, type Automation, type User } from '@/types';
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
    User as UserIcon,
    Video,
    XCircle,
    GitBranch,
    GripVertical,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
    automation: Automation;
    channels: Channel[];
    tags: Tag[];
    operators: User[];
}

type StepType = 'send_text' | 'send_image' | 'send_video' | 'send_file' | 'delay' | 'condition' | 'assign_operator' | 'add_tag' | 'remove_tag' | 'close_chat';

interface StepConfig {
    text?: string;
    url?: string;
    filename?: string;
    delay_seconds?: number;
    condition_type?: string;
    condition_value?: string;
    tag_id?: number; // Backward compatibility
    tag_name?: string; // Backward compatibility
    tag_ids?: number[]; // Multiple tags
    operator_id?: number;
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
    { type: 'remove_tag', label: 'Удалить тег', icon: <TagIcon className="h-4 w-4" />, color: '#ef4444' },
    { type: 'assign_operator', label: 'Назначить оператора', icon: <UserIcon className="h-4 w-4" />, color: '#f97316' },
    { type: 'close_chat', label: 'Закрыть чат', icon: <XCircle className="h-4 w-4" />, color: '#ef4444' },
];

export default function AutomationsEdit({ automation, channels, tags, operators }: Props) {
    // Initialize state from existing automation
    const [name, setName] = useState(automation.name);
    const [description, setDescription] = useState(automation.description || '');
    const [channelId, setChannelId] = useState<string>(automation.channel_id?.toString() || '');
    const [trigger, setTrigger] = useState<string>(automation.trigger);
    const [triggerKeywords, setTriggerKeywords] = useState(
        (automation.trigger_config as { keywords?: string })?.keywords || ''
    );
    const [triggerTagId, setTriggerTagId] = useState<string>(
        (automation.trigger_config as { tag_id?: number })?.tag_id?.toString() || ''
    );
    const [isActive, setIsActive] = useState(automation.is_active);
    const [steps, setSteps] = useState<Step[]>(
        (automation.steps || []).map(step => ({
            id: step.step_id,
            type: step.type,
            config: (step.config as StepConfig) || {},
        }))
    );
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Автоматизации', href: '/automations' },
        { title: automation.name, href: `/automations/${automation.id}/edit` },
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
                const newConfig = { ...step.config };
                if (value === undefined || value === null) {
                    delete newConfig[key as keyof typeof newConfig];
                } else {
                    (newConfig as Record<string, unknown>)[key] = value;
                }
                return {
                    ...step,
                    config: newConfig,
                };
            }
            return step;
        }));
    };

    const updateStepConfigMultiple = (stepId: string, updates: Record<string, unknown>) => {
        setSteps(steps.map(step => {
            if (step.id === stepId) {
                const newConfig = { ...step.config };
                Object.keys(updates).forEach(key => {
                    const value = updates[key];
                    if (value === undefined || value === null) {
                        delete newConfig[key as keyof typeof newConfig];
                    } else {
                        (newConfig as Record<string, unknown>)[key] = value;
                    }
                });
                return {
                    ...step,
                    config: newConfig,
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

        // Use fetch with PATCH for updating
        fetch(`/automations/${automation.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
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
                })),
            }),
        }).then(response => {
            if (response.redirected) {
                window.location.href = response.url;
            } else if (response.ok) {
                window.location.href = '/automations';
            }
        }).finally(() => setSaving(false));
    };

    const getStepType = (type: StepType) => stepTypes.find(s => s.type === type);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Редактирование: ${automation.name}`} />

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

                            <div className="max-w-md mx-auto space-y-4">
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
                                                            {step.config.filename || (step.config.url ? 'Видео добавлено' : 'Добавьте видео')}
                                                        </p>
                                                    )}
                                                    {step.type === 'send_file' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.filename || (step.config.url ? 'Файл добавлен' : 'Добавьте файл')}
                                                        </p>
                                                    )}
                                                    {step.type === 'add_tag' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {(() => {
                                                                const tagIds = step.config.tag_ids || [];
                                                                const tagId = step.config.tag_id; // Backward compatibility
                                                                const tagName = step.config.tag_name; // Backward compatibility
                                                                
                                                                if (tagIds.length > 0) {
                                                                    const selectedTags = tagIds
                                                                        .map(id => tags.find(t => t.id === id)?.name)
                                                                        .filter(Boolean);
                                                                    return selectedTags.length > 0 
                                                                        ? selectedTags.join(', ') 
                                                                        : 'Выберите теги...';
                                                                } else if (tagId) {
                                                                    const tag = tags.find(t => t.id === tagId);
                                                                    return tag?.name || 'Выберите теги...';
                                                                } else if (tagName) {
                                                                    return tagName;
                                                                }
                                                                return 'Выберите теги...';
                                                            })()}
                                                        </p>
                                                    )}
                                                    {step.type === 'remove_tag' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.tag_name || 'Выберите тег...'}
                                                        </p>
                                                    )}
                                                    {step.type === 'condition' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {(
                                                                step.config.condition_type === 'has_tag' ? 'Есть тег' :
                                                                step.config.condition_type === 'message_contains' ? 'Сообщение содержит' :
                                                                step.config.condition_type === 'any_message' ? 'Любое сообщение' :
                                                                step.config.condition_type === 'is_new_client' ? 'Новый клиент' :
                                                                'Настройте условие...'
                                                            )}
                                                        </p>
                                                    )}
                                                    {step.type === 'close_chat' && (
                                                        <p className="text-sm text-muted-foreground">Закрывает чат</p>
                                                    )}
                                                    {step.type === 'assign_operator' && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {step.config.operator_id 
                                                                ? operators.find(op => op.id === step.config.operator_id)?.name || 'Оператор не выбран'
                                                                : 'Выберите оператора...'}
                                                        </p>
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
                                            <Label>Теги</Label>
                                            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                                                {tags.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-2">
                                                        Нет доступных тегов
                                                    </p>
                                                ) : (
                                                    tags.map((tag) => {
                                                        const tagIds = selectedStep.config.tag_ids || [];
                                                        const tagId = selectedStep.config.tag_id; // Backward compatibility
                                                        const isSelected = tagIds.includes(tag.id) || tagId === tag.id;
                                                        
                                                        return (
                                                            <label
                                                                key={tag.id}
                                                                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        // Handle boolean or "indeterminate" from Radix UI
                                                                        if (checked === "indeterminate") return;
                                                                        
                                                                        setSteps(prevSteps => prevSteps.map(step => {
                                                                            if (step.id === selectedStep.id) {
                                                                                const currentTagIds = step.config.tag_ids || [];
                                                                                const stepTagId = step.config.tag_id; // Backward compatibility
                                                                                
                                                                                // Migrate from old single tag_id to array
                                                                                const allTagIds = stepTagId && !currentTagIds.length 
                                                                                    ? [stepTagId] 
                                                                                    : currentTagIds;
                                                                                
                                                                                let newTagIds: number[];
                                                                                if (checked === true) {
                                                                                    // Avoid duplicates
                                                                                    if (!allTagIds.includes(tag.id)) {
                                                                                        newTagIds = [...allTagIds, tag.id];
                                                                                    } else {
                                                                                        newTagIds = allTagIds;
                                                                                    }
                                                                                } else {
                                                                                    newTagIds = allTagIds.filter(id => id !== tag.id);
                                                                                }
                                                                                
                                                                                const newConfig = { ...step.config };
                                                                                newConfig.tag_ids = newTagIds;
                                                                                
                                                                                // Clear old single tag fields when using new array format
                                                                                if (newTagIds.length > 0) {
                                                                                    delete newConfig.tag_id;
                                                                                    delete newConfig.tag_name;
                                                                                }
                                                                                
                                                                                return {
                                                                                    ...step,
                                                                                    config: newConfig,
                                                                                };
                                                                            }
                                                                            return step;
                                                                        }));
                                                                    }}
                                                                />
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <div
                                                                        className="w-3 h-3 rounded-full"
                                                                        style={{ backgroundColor: tag.color }}
                                                                    />
                                                                    <span className="text-sm">{tag.name}</span>
                                                                </div>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            {(() => {
                                                const tagIds = selectedStep.config.tag_ids || [];
                                                const tagId = selectedStep.config.tag_id;
                                                const selectedCount = tagIds.length || (tagId ? 1 : 0);
                                                return selectedCount > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Выбрано тегов: {selectedCount}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {selectedStep.type === 'remove_tag' && (
                                        <div>
                                            <Label>Тег для удаления</Label>
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
                                                        <SelectItem value="any_message">Любое сообщение</SelectItem>
                                                        <SelectItem value="is_new_client">Новый клиент</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {selectedStep.config.condition_type === 'has_tag' && (
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
                                            )}

                                            {selectedStep.config.condition_type === 'message_contains' && (
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

                                            {selectedStep.config.condition_type === 'any_message' && (
                                                <div>
                                                    <Label>Любое входящее сообщение</Label>
                                                    <p className="text-sm text-muted-foreground mt-2">Условие срабатывает на любое входящее сообщение и не требует значения.</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {selectedStep.type === 'assign_operator' && (
                                        <div>
                                            <Label>Оператор</Label>
                                            <Select
                                                value={selectedStep.config.operator_id?.toString() || ''}
                                                onValueChange={(v) => {
                                                    updateStepConfig(selectedStep.id, 'operator_id', v ? parseInt(v) : null);
                                                }}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue placeholder="Выберите оператора" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {operators.map((operator) => (
                                                        <SelectItem key={operator.id} value={operator.id.toString()}>
                                                            {operator.name} {operator.email ? `(${operator.email})` : ''}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
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
