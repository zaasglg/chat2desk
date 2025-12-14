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
    Folder,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
    automation: Automation;
    channels: Channel[];
    tags: Tag[];
    operators: User[];
}

type StepType = 'send_text' | 'send_image' | 'send_video' | 'send_file' | 'delay' | 'condition' | 'assign_operator' | 'add_tag' | 'remove_tag' | 'close_chat' | 'send_text_with_buttons' | 'group';

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
    buttons?: Array<{ 
        text: string; 
        url?: string; 
        action?: 'send_photo' | 'send_video' | 'send_file' | 'send_text' | 'add_tag' | 'remove_tag';
        action_config?: {
            url?: string;
            text?: string;
            tag_ids?: number[];
        };
    }>; // Для инлайн кнопок
    name?: string; // Название группы
    steps?: Step[]; // Шаги внутри группы
}

interface Step {
    id: string;
    type: StepType;
    config: StepConfig;
    isExpanded?: boolean; // Для групп: раскрыта ли группа
}

const stepTypes: { type: StepType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'send_text', label: 'Отправить текст', icon: <MessageSquare className="h-4 w-4" />, color: '#22c55e' },
    { type: 'send_text_with_buttons', label: 'Отправить текст с кнопками', icon: <MessageSquare className="h-4 w-4" />, color: '#10b981' },
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
            isExpanded: step.type === 'group' ? true : undefined,
        }))
    );
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Автоматизации', href: '/automations' },
        { title: automation.name, href: `/automations/${automation.id}/edit` },
    ];

    // Рекурсивная функция для поиска шага в группах
    const findStep = (stepsList: Step[], stepId: string): Step | undefined => {
        for (const step of stepsList) {
            if (step.id === stepId) {
                return step;
            }
            if (step.type === 'group' && step.config.steps) {
                const found = findStep(step.config.steps, stepId);
                if (found) return found;
            }
        }
        return undefined;
    };

    const selectedStep = selectedStepId ? findStep(steps, selectedStepId) : undefined;

    const addStep = (type: StepType, groupId?: string) => {
        const newStep: Step = {
            id: `step-${Date.now()}`,
            type,
            config: type === 'delay' ? { delay_seconds: 5 } : type === 'group' ? { name: 'Новая группа', steps: [] } : {},
            isExpanded: type === 'group' ? true : undefined,
        };
        
        if (groupId) {
            // Добавляем шаг в группу
            setSteps(steps.map(step => {
                if (step.id === groupId && step.type === 'group') {
                    return {
                        ...step,
                        config: {
                            ...step.config,
                            steps: [...(step.config.steps || []), newStep],
                        },
                    };
                }
                return step;
            }));
            setSelectedStepId(newStep.id);
        } else {
            // Добавляем шаг на верхний уровень
            setSteps([...steps, newStep]);
            setSelectedStepId(newStep.id);
        }
    };

    const addGroup = () => {
        addStep('group');
    };

    const updateStepConfig = (stepId: string, key: string, value: unknown, groupId?: string) => {
        const updateStepInList = (stepsList: Step[]): Step[] => {
            return stepsList.map(step => {
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
                if (step.type === 'group' && step.config.steps) {
                    return {
                        ...step,
                        config: {
                            ...step.config,
                            steps: updateStepInList(step.config.steps),
                        },
                    };
                }
                return step;
            });
        };
        
        setSteps(updateStepInList(steps));
    };

    const updateStepConfigMultiple = (stepId: string, updates: Record<string, unknown>, groupId?: string) => {
        const updateStepInList = (stepsList: Step[]): Step[] => {
            return stepsList.map(step => {
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
                if (step.type === 'group' && step.config.steps) {
                    return {
                        ...step,
                        config: {
                            ...step.config,
                            steps: updateStepInList(step.config.steps),
                        },
                    };
                }
                return step;
            });
        };
        
        setSteps(updateStepInList(steps));
    };


    const deleteStep = (stepId: string, groupId?: string) => {
        if (groupId) {
            // Удаляем шаг из группы
            setSteps(steps.map(step => {
                if (step.id === groupId && step.type === 'group') {
                    return {
                        ...step,
                        config: {
                            ...step.config,
                            steps: (step.config.steps || []).filter((s: Step) => s.id !== stepId),
                        },
                    };
                }
                return step;
            }));
        } else {
            // Удаляем шаг с верхнего уровня
            setSteps(steps.filter(s => s.id !== stepId));
        }
        if (selectedStepId === stepId) {
            setSelectedStepId(null);
        }
    };

    const toggleGroup = (groupId: string) => {
        setSteps(steps.map(step => {
            if (step.id === groupId && step.type === 'group') {
                return {
                    ...step,
                    isExpanded: !step.isExpanded,
                };
            }
            return step;
        }));
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

        router.patch(`/automations/${automation.id}`, {
            name,
            description,
            channel_id: channelId || null,
            trigger,
            trigger_config:
                trigger === 'keyword' ? { keywords: triggerKeywords } :
                    (trigger === 'tag_added' || trigger === 'tag_removed') ? { tag_id: parseInt(triggerTagId) } :
                        null,
            is_active: isActive,
            steps: steps.map((step, index) => {
                // Очищаем конфигурацию кнопок перед отправкой
                let cleanedConfig = { ...step.config };
                if (step.type === 'send_text_with_buttons' && cleanedConfig.buttons) {
                    cleanedConfig.buttons = cleanedConfig.buttons
                        .filter((btn: any) => {
                            // Фильтруем кнопки без текста
                            if (!btn.text) return false;
                            
                            // Если есть URL, кнопка валидна
                            if (btn.url) return true;
                            
                            // Если есть action, проверяем наличие необходимых данных в action_config
                            if (btn.action && btn.action_config) {
                                const config = btn.action_config;
                                switch (btn.action) {
                                    case 'send_photo':
                                    case 'send_video':
                                    case 'send_file':
                                        return !!(config.url);
                                    case 'send_text':
                                        return !!(config.text);
                                    case 'add_tag':
                                    case 'remove_tag':
                                        return !!(config.tag_ids && config.tag_ids.length > 0);
                                    default:
                                        return false;
                                }
                            }
                            
                            return false;
                        })
                        .map((btn: any) => {
                            const cleanedBtn: any = { text: btn.text };
                            if (btn.url) {
                                cleanedBtn.url = btn.url;
                            }
                            if (btn.action && btn.action_config) {
                                cleanedBtn.action = btn.action;
                                cleanedBtn.action_config = btn.action_config;
                            }
                            return cleanedBtn;
                        });
                }
                
                return {
                    step_id: step.id,
                    type: step.type,
                    config: cleanedConfig,
                    position: { x: 250, y: index * 150 },
                    next_step_id: steps[index + 1]?.id || null,
                };
            }),
        }, {
            onFinish: () => setSaving(false),
        });
    };

    const getStepType = (type: StepType) => stepTypes.find(s => s.type === type);

    // Рекурсивная функция для рендеринга шага (включая группы)
    const renderStep = (step: Step, index: number, groupId: string | undefined, level: number = 0) => {
        const stepType = getStepType(step.type);
        const groupSteps = step.type === 'group' ? step.config.steps || [] : [];
        
        return (
            <div key={step.id} className={level > 0 ? 'ml-4 border-l-2 border-border pl-4' : ''}>
                {step.type === 'group' ? (
                    <>
                        <Card
                            className={`!py-0 cursor-pointer transition-all ${selectedStepId === step.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStepId(step.id);
                            }}
                        >
                            <div
                                className="px-4 py-4 rounded-t-lg flex items-center gap-2 text-white text-sm font-medium"
                                style={{ backgroundColor: '#6366f1' }}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroup(step.id);
                                    }}
                                    className="hover:bg-white/20 p-1 rounded"
                                >
                                    {step.isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" />
                                    )}
                                </button>
                                <Folder className="h-4 w-4" />
                                <span className="flex-1">{step.config.name || 'Новая группа'}</span>
                                <span className="text-xs opacity-75">
                                    {(step.config.steps || []).length} шаг{(step.config.steps || []).length !== 1 ? 'ов' : ''}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-white/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteStep(step.id, groupId);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            {step.isExpanded && (
                                <CardContent className="p-3 space-y-2">
                                    {groupSteps.length > 0 ? (
                                        groupSteps.map((groupStep: Step, groupIndex: number) => (
                                            <div key={groupStep.id}>
                                                {renderStep(groupStep, groupIndex, step.id, level + 1)}
                                                {groupIndex < groupSteps.length - 1 && (
                                                    <div className="flex justify-center pt-2">
                                                        <div className="w-0.5 h-4 bg-border" />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            Группа пуста. Добавьте шаги.
                                        </p>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedStepId(step.id);
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-2" />
                                        Добавить шаг в группу
                                    </Button>
                                </CardContent>
                            )}
                        </Card>
                    </>
                ) : (
                    <Card
                        className={`!py-0 cursor-pointer transition-all ${selectedStepId === step.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStepId(step.id);
                        }}
                    >
                        <div
                            className="px-4 py-4 rounded-t-lg flex items-center gap-2 text-white text-sm font-medium"
                            style={{ backgroundColor: stepType?.color || '#6b7280' }}
                        >
                            <GripVertical className="h-4 w-4 opacity-50" />
                            {stepType?.icon}
                            <span className="flex-1">{stepType?.label}</span>
                            <span className="text-xs opacity-75">#{index + 1}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-white/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteStep(step.id, groupId);
                                }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                        <CardContent className="p-3">
                            {step.type === 'send_text' && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {step.config.text || 'Введите текст сообщения...'}
                                </p>
                            )}
                            {step.type === 'send_text_with_buttons' && (
                                <div className="space-y-2">
                                    {step.config.url && (
                                        <img
                                            src={step.config.url.startsWith('http') || step.config.url.startsWith('/') ? step.config.url : `/storage/${step.config.url}`}
                                            alt="Preview"
                                            className="w-full h-32 object-cover rounded-md"
                                        />
                                    )}
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {step.config.text || 'Введите текст сообщения...'}
                                    </p>
                                    {step.config.buttons && step.config.buttons.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {step.config.buttons.map((btn: any, idx: number) => (
                                                <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                    {btn.text}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                                    {(() => {
                                        const tagIds = step.config.tag_ids || [];
                                        const tagId = step.config.tag_id;
                                        const tagName = step.config.tag_name;
                                        
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
                                    {step.config.condition_type || 'Настройте условие...'}
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
                )}
                
                {/* Connection Line - только для верхнего уровня */}
                {level === 0 && (() => {
                    const parentSteps = groupId 
                        ? (steps.find(s => s.id === groupId)?.config.steps || [])
                        : steps;
                    return index < parentSteps.length - 1;
                })() && (
                    <div className="flex justify-center pt-4">
                        <div className="w-0.5 h-8 bg-border" />
                    </div>
                )}
            </div>
        );
    };

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
                                                <SelectItem value="incoming_message">Входящее сообщение</SelectItem>
                                                <SelectItem value="chat_opened">Чат открыт оператором</SelectItem>
                                                <SelectItem value="chat_closed">Чат закрыт</SelectItem>
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
                                    return renderStep(step, index, undefined, 0);
                                })}

                                {/* Add Group Button */}
                                <div className="flex justify-center pt-4">
                                    <Button
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={addGroup}
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
                                    {selectedStep.type === 'group' && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Название группы</Label>
                                                <Input
                                                    className="mt-1"
                                                    placeholder="Название группы"
                                                    value={selectedStep.config.name || ''}
                                                    onChange={(e) => updateStepConfig(selectedStep.id, 'name', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label>Добавить шаг в группу</Label>
                                                <div className="space-y-2 mt-2">
                                                    {stepTypes.filter(st => st.type !== 'group').map((stepType) => (
                                                        <button
                                                            key={stepType.type}
                                                            onClick={() => addStep(stepType.type, selectedStep.id)}
                                                            className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-accent text-left transition-colors"
                                                        >
                                                            <div
                                                                className="p-1.5 rounded text-white"
                                                                style={{ backgroundColor: stepType.color }}
                                                            >
                                                                {stepType.icon}
                                                            </div>
                                                            <span className="text-sm">{stepType.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {selectedStep.type !== 'group' && (
                                        <>
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

                                    {selectedStep.type === 'send_text_with_buttons' && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Изображение (необязательно)</Label>
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
                                            </div>

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

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label>Инлайн кнопки</Label>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const currentButtons = selectedStep.config.buttons || [];
                                                            updateStepConfig(selectedStep.id, 'buttons', [
                                                                ...currentButtons,
                                                                { text: '' }
                                                            ]);
                                                        }}
                                                    >
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Добавить кнопку
                                                    </Button>
                                                </div>

                                                <div className="space-y-2">
                                                    {(selectedStep.config.buttons || []).map((button: any, index: number) => (
                                                        <div key={index} className="border rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-sm">Кнопка {index + 1}</Label>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const currentButtons = selectedStep.config.buttons || [];
                                                                        const newButtons = currentButtons.filter((_: any, i: number) => i !== index);
                                                                        updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs">Текст кнопки</Label>
                                                                <Input
                                                                    className="mt-1"
                                                                    placeholder="Текст кнопки"
                                                                    value={button.text || ''}
                                                                    onChange={(e) => {
                                                                        const currentButtons = selectedStep.config.buttons || [];
                                                                        const newButtons = [...currentButtons];
                                                                        newButtons[index] = { ...newButtons[index], text: e.target.value };
                                                                        updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-xs">Тип кнопки</Label>
                                                                <Select
                                                                    value={button.url !== undefined ? 'url' : (button.action || 'url')}
                                                                    onValueChange={(value) => {
                                                                        const currentButtons = selectedStep.config.buttons || [];
                                                                        const newButtons = [...currentButtons];
                                                                        if (value === 'url') {
                                                                            newButtons[index] = { text: newButtons[index].text, url: '' };
                                                                            delete newButtons[index].action;
                                                                            delete newButtons[index].action_config;
                                                                        } else {
                                                                            newButtons[index] = { 
                                                                                text: newButtons[index].text, 
                                                                                action: value as any,
                                                                                action_config: {}
                                                                            };
                                                                            delete newButtons[index].url;
                                                                        }
                                                                        updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="mt-1">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="url">URL (ссылка)</SelectItem>
                                                                        <SelectItem value="send_photo">Отправить фото</SelectItem>
                                                                        <SelectItem value="send_video">Отправить видео</SelectItem>
                                                                        <SelectItem value="send_file">Отправить файл</SelectItem>
                                                                        <SelectItem value="send_text">Отправить текст</SelectItem>
                                                                        <SelectItem value="add_tag">Добавить теги</SelectItem>
                                                                        <SelectItem value="remove_tag">Удалить теги</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            {button.url !== undefined && (
                                                                <div>
                                                                    <Label className="text-xs">URL</Label>
                                                                    <Input
                                                                        className="mt-1"
                                                                        placeholder="https://example.com"
                                                                        value={button.url || ''}
                                                                        onChange={(e) => {
                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                            const newButtons = [...currentButtons];
                                                                            newButtons[index] = { ...newButtons[index], url: e.target.value };
                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {button.action === 'send_photo' && (
                                                                <div>
                                                                    <Label className="text-xs">URL изображения</Label>
                                                                    <Input
                                                                        className="mt-1"
                                                                        placeholder="https://example.com/image.jpg"
                                                                        value={button.action_config?.url || ''}
                                                                        onChange={(e) => {
                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                            const newButtons = [...currentButtons];
                                                                            newButtons[index] = { 
                                                                                ...newButtons[index], 
                                                                                action_config: { ...newButtons[index].action_config, url: e.target.value }
                                                                            };
                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {button.action === 'send_video' && (
                                                                <div>
                                                                    <Label className="text-xs">URL видео</Label>
                                                                    <Input
                                                                        className="mt-1"
                                                                        placeholder="https://example.com/video.mp4"
                                                                        value={button.action_config?.url || ''}
                                                                        onChange={(e) => {
                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                            const newButtons = [...currentButtons];
                                                                            newButtons[index] = { 
                                                                                ...newButtons[index], 
                                                                                action_config: { ...newButtons[index].action_config, url: e.target.value }
                                                                            };
                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {button.action === 'send_file' && (
                                                                <div>
                                                                    <Label className="text-xs">URL файла</Label>
                                                                    <Input
                                                                        className="mt-1"
                                                                        placeholder="https://example.com/file.pdf"
                                                                        value={button.action_config?.url || ''}
                                                                        onChange={(e) => {
                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                            const newButtons = [...currentButtons];
                                                                            newButtons[index] = { 
                                                                                ...newButtons[index], 
                                                                                action_config: { ...newButtons[index].action_config, url: e.target.value }
                                                                            };
                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {button.action === 'send_text' && (
                                                                <div>
                                                                    <Label className="text-xs">Текст сообщения</Label>
                                                                    <Textarea
                                                                        className="mt-1"
                                                                        placeholder="Введите текст сообщения"
                                                                        value={button.action_config?.text || ''}
                                                                        onChange={(e) => {
                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                            const newButtons = [...currentButtons];
                                                                            newButtons[index] = { 
                                                                                ...newButtons[index], 
                                                                                action_config: { ...newButtons[index].action_config, text: e.target.value }
                                                                            };
                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                            {(button.action === 'add_tag' || button.action === 'remove_tag') && (
                                                                <div>
                                                                    <Label className="text-xs">Выберите теги</Label>
                                                                    <div className="mt-1 space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                                                                        {tags.map((tag) => {
                                                                            const isSelected = button.action_config?.tag_ids?.includes(tag.id);
                                                                            return (
                                                                                <div key={tag.id} className="flex items-center space-x-2">
                                                                                    <Checkbox
                                                                                        checked={isSelected}
                                                                                        onCheckedChange={(checked) => {
                                                                                            const currentButtons = selectedStep.config.buttons || [];
                                                                                            const newButtons = [...currentButtons];
                                                                                            const currentTagIds = newButtons[index].action_config?.tag_ids || [];
                                                                                            const newTagIds = checked
                                                                                                ? [...currentTagIds, tag.id]
                                                                                                : currentTagIds.filter((id: number) => id !== tag.id);
                                                                                            newButtons[index] = { 
                                                                                                ...newButtons[index], 
                                                                                                action_config: { ...newButtons[index].action_config, tag_ids: newTagIds }
                                                                                            };
                                                                                            updateStepConfig(selectedStep.id, 'buttons', newButtons);
                                                                                        }}
                                                                                    />
                                                                                    <Label className="text-sm cursor-pointer">
                                                                                        <span
                                                                                            className="inline-block px-2 py-1 rounded text-xs"
                                                                                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                                                        >
                                                                                            {tag.name}
                                                                                        </span>
                                                                                    </Label>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {(!selectedStep.config.buttons || selectedStep.config.buttons.length === 0) && (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                            Нет кнопок. Нажмите "Добавить кнопку" для создания.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
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
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
