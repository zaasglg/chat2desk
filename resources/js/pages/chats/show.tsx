import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Chat, type Message, type Tag, type User } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Send,
    Paperclip,
    MoreVertical,
    User as UserIcon,
    Phone,
    Mail,
    Clock,
    Check,
    CheckCheck,
    AlertCircle,
    Plus,
    X,
    Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
    chat: Chat;
    allTags: Tag[];
    chats: Chat[];
    stats: {
        all: number;
        unread: number;
    };
    filters: {
        category?: string;
        search?: string;
    };
}

const statusLabels = {
    new: 'Новый',
    open: 'Открыт',
    pending: 'Ожидание',
    resolved: 'Решен',
    closed: 'Закрыт',
};

const priorityLabels = {
    low: 'Низкий',
    normal: 'Обычный',
    high: 'Высокий',
    urgent: 'Срочный',
};

const channelIcons: Record<string, string> = {
    telegram: '✈️',
    whatsapp: '📱',
    instagram: '📷',
    facebook: '👤',
    vk: '🔵',
    viber: '💜',
    email: '📧',
    web: '🌐',
};

export default function ChatShow({ chat, allTags, chats, stats, filters }: Props) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatColumnRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef<boolean>(true);
    const prevChatElRef = useRef<HTMLElement | null>(null);
    const onChatScroll = () => {
        const el = chatColumnRef.current;
        if (!el) return;
        const threshold = 150; // px from bottom to consider as "near bottom"
        const atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < threshold;
        autoScrollRef.current = atBottom;
    };
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [clientTags, setClientTags] = useState<Tag[]>(chat.client?.tags || []);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>(chat.messages || []);
    const [clientNotes, setClientNotes] = useState(chat.client?.notes || '');
    const [savingNotes, setSavingNotes] = useState(false);
    const [operators, setOperators] = useState<User[]>([]);
    const [operatorGroups, setOperatorGroups] = useState<any[]>([]);
    const [transferOpen, setTransferOpen] = useState(false);
    const [selectedOperator, setSelectedOperator] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const toast = useToast();

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Чаты', href: '/chats' },
        { title: chat.client?.name || `Чат #${chat.id}`, href: `/chats/${chat.id}` },
    ];

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== filters.search) {
                router.get(`/chats/${chat.id}`, {
                    ...filters,
                    search: searchQuery || undefined,
                }, { preserveState: true, preserveScroll: true });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (autoScrollRef.current) {
            scrollToBottom();
        }
    }, []);

    // Polling для получения новых сообщений
    useEffect(() => {
        const fetchNewMessages = async () => {
            try {
                const response = await fetch(`/chats/${chat.id}/messages`);
                if (response.ok) {
                    const data = await response.json();
                    setMessages(data);
                }
            } catch (error) {
                console.error('Failed to fetch messages:', error);
            }
        };

        // Polling каждые 3 секунды
        const interval = setInterval(fetchNewMessages, 3000);

        return () => clearInterval(interval);
    }, [chat.id]);

    useEffect(() => {
        return () => {
            // remove scroll listener from previous element if any
            if (prevChatElRef.current) prevChatElRef.current.removeEventListener('scroll', onChatScroll);
        };
    }, []);

    useEffect(() => {
        // preload operators and groups for transfer dropdown
        (async () => {
            try {
                const [uRes, gRes] = await Promise.all([
                    fetch('/api/users'),
                    fetch('/api/operator-groups'),
                ]);
                if (uRes.ok) setOperators(await uRes.json());
                if (gRes.ok) setOperatorGroups(await gRes.json());
            } catch (err) {
                console.error('Failed to fetch operators/groups', err);
            }
        })();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || sending) return;

        setSending(true);
        try {
            let contentToSend = message;

            // If message starts with a slash, try to resolve a quick-reply shortcut
            const trimmed = message.trim();
            if (trimmed.startsWith('/')) {
                try {
                    const q = encodeURIComponent(trimmed);
                    const searchRes = await fetch(`/api/quick-replies/search?q=${q}`);
                    if (searchRes.ok) {
                        const results = await searchRes.json();
                        // find exact shortcut match (server may return multiple suggestions)
                        const match = results.find((r: any) => r.shortcut === trimmed);
                        if (match) {
                            // call use endpoint to increment usage and get canonical content
                            const useRes = await fetch(`/quick-replies/${match.id}/use`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                                },
                            });
                            if (useRes.ok) {
                                const payload = await useRes.json();
                                if (payload && payload.content) {
                                    contentToSend = payload.content;
                                }
                            }
                        }
                    }
                } catch (err) {
                    // ignore quick-reply lookup errors and fall back to sending raw message
                    console.error('Quick-reply lookup failed', err);
                }
            }

            const response = await fetch(`/chats/${chat.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ content: contentToSend }),
            });

            if (response.ok) {
                const newMessage = await response.json();
                setMessages((prev) => [...prev, newMessage]);
                setMessage('');
                // force-scroll to show sent message
                scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
    };

    const toggleTag = async (tag: Tag) => {
        if (!chat.client) return;
        
        const isSelected = clientTags.some(t => t.id === tag.id);
        const newTags = isSelected 
            ? clientTags.filter(t => t.id !== tag.id)
            : [...clientTags, tag];
        
        setClientTags(newTags);
        
        try {
            await fetch(`/clients/${chat.client.id}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ tag_ids: newTags.map(t => t.id) }),
            });
        } catch (error) {
            console.error('Failed to sync tags:', error);
            // Revert on error
            setClientTags(isSelected ? [...clientTags, tag] : clientTags.filter(t => t.id !== tag.id));
        }
    };

    const removeTag = async (tag: Tag) => {
        if (!chat.client) return;
        
        const newTags = clientTags.filter(t => t.id !== tag.id);
        setClientTags(newTags);
        
        try {
            await fetch(`/clients/${chat.client.id}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ tag_ids: newTags.map(t => t.id) }),
            });
        } catch (error) {
            console.error('Failed to remove tag:', error);
            setClientTags([...newTags, tag]);
        }
    };

    const saveNotes = async () => {
        if (!chat.client) return;
        
        setSavingNotes(true);
        try {
            await fetch(`/clients/${chat.client.id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ notes: clientNotes }),
            });
        } catch (error) {
            console.error('Failed to save notes:', error);
        } finally {
            setSavingNotes(false);
        }
    };

    const handleStatusChange = (status: string) => {
        router.post(`/chats/${chat.id}/status`, { status }, { preserveScroll: true });
    };

    const handlePriorityChange = (priority: string) => {
        router.post(`/chats/${chat.id}/priority`, { priority }, { preserveScroll: true });
    };

    const assignToOperator = async (operatorId: number | null) => {
        setAssigning(true);
        try {
            const res = await fetch(`/chats/${chat.id}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ operator_id: operatorId }),
            });
            if (res.ok) {
                toast?.success('Чат назначен оператору');
                // reload page to reflect assignment (simple approach)
                window.location.reload();
            } else {
                toast?.error('Не удалось назначить оператора');
            }
        } catch (err) {
            console.error(err);
            toast?.error('Ошибка при назначении');
        } finally {
            setAssigning(false);
        }
    };

    const assignToGroup = async (groupId: number | null) => {
        setAssigning(true);
        try {
            const res = await fetch(`/chats/${chat.id}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ operator_group_id: groupId }),
            });
            if (res.ok) {
                toast?.success('Чат передан в группу');
                window.location.reload();
            } else {
                toast?.error('Не удалось передать в группу');
            }
        } catch (err) {
            console.error(err);
            toast?.error('Ошибка при передаче в группу');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={chat.client?.name || `Чат #${chat.id}`} />
            <div className="flex h-full overflow-hidden h-svh">
                {/* Chats List Sidebar */}
                <div className="w-80 border-r bg-muted/30 flex flex-col h-full flex-shrink-0">
                    {/* Search and Filters */}
                    <div className="p-4 border-b space-y-3 flex-shrink-0">
                        <div className="flex gap-2">
                            <Button
                                variant={!filters.category || filters.category === 'all' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => router.get(chat.id === 0 ? '/chats' : `/chats/${chat.id}`, { category: 'all' })}
                            >
                                Все чаты
                                {stats.all > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {stats.all}
                                    </Badge>
                                )}
                            </Button>
                            <Button
                                variant={filters.category === 'unread' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => router.get(chat.id === 0 ? '/chats' : `/chats/${chat.id}`, { category: 'unread' })}
                            >
                                Непрочитанные
                                {stats.unread > 0 && (
                                    <Badge variant="destructive" className="ml-2">
                                        {stats.unread}
                                    </Badge>
                                )}
                            </Button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Поиск чатов..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Chats List */}
                    <div className="flex-1 overflow-auto">
                        {chats.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                Нет чатов
                            </div>
                        ) : (
                            <div className="divide-y">
                                {chats.map((chatItem) => {
                                    const isActive = chatItem.id === chat.id;
                                    const hasUnread = chatItem.unread_count > 0;
                                    // latestMessage приходит как массив из-за HasMany в модели
                                    const latestMsg = Array.isArray(chatItem.latest_message) 
                                        ? chatItem.latest_message[0] 
                                        : chatItem.latest_message;
                                    
                                    return (
                                        <a
                                            key={chatItem.id}
                                            href={`/chats/${chatItem.id}?${new URLSearchParams(filters as any).toString()}`}
                                            className={`block p-4 hover:bg-accent/50 transition-colors ${
                                                isActive ? 'bg-accent' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Avatar className="h-10 w-10 flex-shrink-0">
                                                    <AvatarImage src={chatItem.client?.avatar} />
                                                    <AvatarFallback>
                                                        <UserIcon className="h-5 w-5" />
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className={`font-medium truncate ${
                                                            hasUnread ? 'font-semibold' : ''
                                                        }`}>
                                                            {chatItem.client?.name || `Клиент #${chatItem.client_id}`}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                                            {chatItem.last_message_at
                                                                ? new Date(chatItem.last_message_at).toLocaleTimeString('ru-RU', {
                                                                      hour: '2-digit',
                                                                      minute: '2-digit',
                                                                  })
                                                                : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={`text-sm truncate flex-1 ${
                                                            hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
                                                        }`}>
                                                            {latestMsg?.content || 'Нет сообщений'}
                                                        </p>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {chatItem.channel && (
                                                                <span className="text-base">
                                                                    {channelIcons[chatItem.channel.type] || '💬'}
                                                                </span>
                                                            )}
                                                            {hasUnread && (
                                                                <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                                                                    {chatItem.unread_count}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {chatItem.client?.tags && chatItem.client.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {chatItem.client.tags.slice(0, 3).map((tag) => (
                                                                <Badge
                                                                    key={tag.id}
                                                                    variant="secondary"
                                                                    className="text-xs px-1.5 py-0 h-5"
                                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                                >
                                                                    {tag.name}
                                                                </Badge>
                                                            ))}
                                                            {chatItem.client.tags.length > 3 && (
                                                                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                                                                    +{chatItem.client.tags.length - 3}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div
                    ref={(el) => {
                        // detach listener from previous element
                        if (prevChatElRef.current && prevChatElRef.current !== el) {
                            prevChatElRef.current.removeEventListener('scroll', onChatScroll);
                        }

                        chatColumnRef.current = el;
                        prevChatElRef.current = el;

                        if (el) {
                            el.addEventListener('scroll', onChatScroll, { passive: true });
                            // initialize auto-scroll flag
                            onChatScroll();
                        }
                    }}
                    className="flex flex-1 flex-col h-full overflow-hidden"
                >
                    {chat.id === 0 ? (
                        /* Empty State */
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <h3 className="text-lg font-semibold mb-2">Нет чатов</h3>
                                <p className="text-sm text-muted-foreground">
                                    Выберите чат из списка или дождитесь новых сообщений
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Scrollable area: header + messages */}
                            <div className="flex-1 overflow-y-auto">
                                {/* Header (sticky inside scroll container) */}
                                <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
                                    <div className="flex items-center gap-4 p-4">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={chat.client?.avatar} />
                                            <AvatarFallback>
                                                <UserIcon className="h-5 w-5" />
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {chat.client?.name || `Клиент #${chat.client_id}`}
                                                </span>
                                                <span className="text-lg">
                                                    {channelIcons[chat.channel?.type || 'web']}
                                                </span>
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                {chat.channel?.name}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Select value={chat.status} onValueChange={handleStatusChange}>
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(statusLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={chat.priority} onValueChange={handlePriorityChange}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(priorityLabels).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Transfer control */}
                                    <Popover open={transferOpen} onOpenChange={setTransferOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 ml-2">
                                                Передать
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-3">
                                            <div className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Назначить оператору</p>
                                                    <Select
                                                        value={selectedOperator ? String(selectedOperator) : ''}
                                                        onValueChange={(v) => setSelectedOperator(v ? Number(v) : null)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Выберите оператора" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {operators.map((op) => (
                                                                <SelectItem key={op.id} value={String(op.id)}>
                                                                    {op.name} {op.email ? `(${op.email})` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="mt-2 flex gap-2">
                                                        <Button size="sm" onClick={() => assignToOperator(selectedOperator)} disabled={assigning}>
                                                            Назначить
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => assignToOperator(null)} disabled={assigning}>
                                                            Снять назначение
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <p className="text-xs text-muted-foreground mb-1">Передать группе</p>
                                                    <Select
                                                        value={selectedGroup ? String(selectedGroup) : ''}
                                                        onValueChange={(v) => setSelectedGroup(v ? Number(v) : null)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Выберите группу" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {operatorGroups.map((g) => (
                                                                <SelectItem key={g.id} value={String(g.id)}>
                                                                    {g.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="mt-2 flex gap-2">
                                                        <Button size="sm" onClick={() => assignToGroup(selectedGroup)} disabled={assigning}>
                                                            Передать
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => assignToGroup(null)} disabled={assigning}>
                                                            Снять группу
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* Messages list */}
                        <div className="p-4 pb-4">
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} message={msg} onImageClick={setLightboxImage} />
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>

                    {/* Input - fixed at bottom of chat area */}
                    <div className="flex-shrink-0 bg-background border-t">
                        <form onSubmit={handleSend} className="flex gap-2 items-center w-full px-4 py-3">
                            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-md">
                                <Paperclip className="h-4 w-4" />
                            </Button>

                            <Input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Введите сообщение..."
                                className="flex-1 rounded-full px-4 py-2"
                                disabled={sending}
                            />

                            <Button
                                type="submit"
                                disabled={!message.trim() || sending}
                                className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                        </>
                    )}
                </div>

                {/* Sidebar - Client Info */}
                {chat.id !== 0 && (
                <div className="w-80 border-l bg-muted/30 h-full flex-shrink-0 overflow-y-auto">
                    <div className="p-4">
                        <h3 className="mb-4 font-semibold">Информация о клиенте</h3>

                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={chat.client?.avatar} />
                                    <AvatarFallback>
                                        <UserIcon className="h-10 w-10" />
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            <div className="text-center">
                                <p className="font-medium">
                                    {chat.client?.name || 'Без имени'}
                                </p>
                            </div>

                            {chat.client?.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{chat.client.phone}</span>
                                </div>
                            )}

                            {chat.client?.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{chat.client.email}</span>
                                </div>
                            )}

                            {chat.operator && (
                                <div className="rounded-lg border p-3">
                                    <p className="text-xs text-muted-foreground mb-1">Оператор</p>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback>
                                                {chat.operator.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{chat.operator.name}</span>
                                    </div>
                                </div>
                            )}

                            {/* Tags Section */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Теги</p>
                                <div className="flex flex-wrap gap-1">
                                    {clientTags.map((tag) => (
                                        <Badge 
                                            key={tag.id} 
                                            variant="secondary"
                                            className="pr-1 gap-1"
                                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                        >
                                            {tag.name}
                                            <button
                                                onClick={() => removeTag(tag)}
                                                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                    <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Добавить
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2" align="start">
                                            <div className="space-y-1 max-h-[300px] overflow-auto">
                                                {allTags.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-2">
                                                        Нет доступных тегов
                                                    </p>
                                                ) : (
                                                    allTags.map((tag) => {
                                                        const isSelected = clientTags.some(t => t.id === tag.id);
                                                        return (
                                                            <button
                                                                key={tag.id}
                                                                onClick={() => toggleTag(tag)}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                                                            >
                                                                <Checkbox checked={isSelected} />
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-xs"
                                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                                >
                                                                    {tag.name}
                                                                </Badge>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Notes/Comments Section */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Комментарий</p>
                                <Textarea
                                    value={clientNotes}
                                    onChange={(e) => setClientNotes(e.target.value)}
                                    onBlur={saveNotes}
                                    placeholder="Добавьте комментарий о клиенте..."
                                    className="min-h-[80px] text-sm resize-none"
                                />
                                {savingNotes && (
                                    <p className="text-xs text-muted-foreground mt-1">Сохранение...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Image Lightbox Modal */}
            {lightboxImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
                        onClick={() => setLightboxImage(null)}
                    >
                        <X className="h-8 w-8" />
                    </button>
                    <img 
                        src={lightboxImage} 
                        alt="Enlarged" 
                        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </AppLayout>
    );
}

function MessageBubble({ message, onImageClick }: { message: Message; onImageClick: (url: string) => void }) {
    const isOutgoing = message.direction === 'outgoing';
    // detect system messages via explicit system_action metadata
    const meta: any = message.metadata || {};
    const isSystem = Boolean(meta.system_action);

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const StatusIcon = () => {
        switch (message.status) {
            case 'sent':
                return <Check className="h-3 w-3" />;
            case 'delivered':
                return <CheckCheck className="h-3 w-3" />;
            case 'read':
                return <CheckCheck className="h-3 w-3 text-blue-500" />;
            case 'failed':
                return <AlertCircle className="h-3 w-3 text-red-500" />;
            default:
                return <Clock className="h-3 w-3" />;
        }
    };

    // Системное сообщение - отображаем по центру
    if (isSystem) {
        return (
            <div className="flex justify-center">
                <div className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-2 text-center">
                    <p className="text-sm text-gray-600">{message.content}</p>
                    <div className="mt-1 text-xs text-gray-400">
                        {formatTime(message.created_at)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOutgoing
                        ? 'bg-sky-500 text-white'
                        : 'bg-sky-100 text-sky-900'
                }`}
            >
                {message.reply_to && (
                    <div className={`mb-2 rounded border-l-2 pl-2 text-xs ${
                        isOutgoing ? 'border-primary-foreground/50 opacity-70' : 'border-muted-foreground'
                    }`}>
                        {message.reply_to.content?.substring(0, 50)}...
                    </div>
                )}

                {message.type === 'text' && <p>{message.content}</p>}
                
                {/* Show caption for media messages */}
                {message.type !== 'text' && message.content && !message.content.startsWith('📷') && !message.content.startsWith('🎬') && !message.content.startsWith('📎') && !message.content.startsWith('🎤') && !message.content.startsWith('🎵') && !message.content.startsWith('🎭') && (
                    <p className="mb-2">{message.content}</p>
                )}

                {message.attachments?.map((att, i) => {
                    const a: any = att;
                    const url = a.url || (att.path ? `/storage/${att.path}` : null);
                    const type = a.type || message.type || '';

                    if (!url) return null;

                    if (type === 'image' || type === 'photo' || type === 'sticker') {
                        return (
                            <img
                                key={i}
                                src={url}
                                alt={att.name || 'image'}
                                className="max-h-60 rounded mb-2 cursor-zoom-in hover:opacity-90 transition-opacity"
                                onClick={() => onImageClick(url)}
                            />
                        );
                    }

                    if (type === 'video') {
                        return (
                            <video key={i} controls className="max-h-80 rounded mb-2 w-full">
                                <source src={url} />
                                Ваш браузер не поддерживает видео.
                            </video>
                        );
                    }

                    if (type === 'voice' || type === 'audio') {
                        return (
                            <audio key={i} controls className="w-full mb-2">
                                <source src={url} />
                                Ваш браузер не поддерживает аудио.
                            </audio>
                        );
                    }

                    // default: treat as downloadable file
                    const fileName = att.name || a.filename || a.file_name || (att.path ? att.path.split('/').pop() : url.split('/').pop());
                    return (
                        <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 underline"
                        >
                            <Paperclip className="h-4 w-4" />
                            {fileName}
                        </a>
                    );
                })}

                <div className={`mt-1 flex items-center justify-end gap-1 text-xs ${
                    isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}>
                    <span>{formatTime(message.created_at)}</span>
                    {isOutgoing && <StatusIcon />}
                </div>
            </div>
        </div>
    );
}
