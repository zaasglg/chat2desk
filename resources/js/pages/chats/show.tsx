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
import { Head, Link, router, useForm } from '@inertiajs/react';
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
    Filter,
    User as UserLucide,
    Inbox,
    MessageSquare,
    Pause,
    CheckCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
    chat: Chat;
    allTags: Tag[];
    chats?: Chat[];
    channels?: any[];
    stats?: any;
    filters?: any;
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

const statusColors = {
    new: 'bg-blue-500',
    open: 'bg-green-500',
    pending: 'bg-yellow-500',
    resolved: 'bg-gray-500',
    closed: 'bg-gray-400',
};

const priorityColors = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500',
};

export default function ChatShow({ chat, allTags, chats = [], channels = [], stats, filters }: Props) {
    // If chat.id is 0, it means no chats exist
    const hasNoChats = chat.id === 0;
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
    const [footerStyle, setFooterStyle] = useState<{ left?: number; width?: number }>({});
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
    const [searchQuery, setSearchQuery] = useState(filters?.search || '');
    
    // Sync searchQuery with filters when they change
    useEffect(() => {
        if (filters?.search !== undefined) {
            setSearchQuery(filters.search);
        }
    }, [filters?.search]);
    
    const handleFilterChange = (key: string, value: string) => {
        const newFilters = {
            ...currentFilters,
            [key]: value,
        };
        setCurrentFilters(newFilters);
        router.get(`/chats/${chat.id}`, newFilters, { preserveState: true });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const newFilters = {
            ...currentFilters,
            search: searchQuery || undefined,
        };
        setCurrentFilters(newFilters);
        router.get(`/chats/${chat.id}`, newFilters, { preserveState: true });
    };
    const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [currentFilters, setCurrentFilters] = useState({
        category: filters?.category || 'all',
        search: filters?.search || undefined,
    });
    const toast = useToast();
    
    // Sync currentFilters when filters prop changes
    useEffect(() => {
        setCurrentFilters({
            category: filters?.category || 'all',
            search: filters?.search || undefined,
        });
    }, [filters]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Чаты', href: '/chats' },
        { title: chat.client?.name || `Чат #${chat.id}`, href: `/chats/${chat.id}` },
    ];

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
        const updatePositions = () => {
            const el = chatColumnRef.current;
            if (el) {
                const rect = el.getBoundingClientRect();
                setFooterStyle({ left: rect.left, width: rect.width });
            }
        };

        // initial
        updatePositions();

        window.addEventListener('resize', updatePositions);

        return () => {
            window.removeEventListener('resize', updatePositions);
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
        <AppLayout breadcrumbs={[]}>
            <Head title={chat.client?.name || `Чат #${chat.id}`} />
            <div className="flex h-screen overflow-hidden">
                {/* Left Sidebar - Chat List */}
                <div className="w-80 border-r bg-background flex flex-col">
                    {/* Categories */}
                    {stats && (
                        <div className="flex gap-2 border-b p-3">
                            <StatCard
                                icon={<MessageSquare className="h-4 w-4" />}
                                label="Все чаты"
                                value={stats.all}
                                active={currentFilters.category === 'all'}
                                onClick={() => handleFilterChange('category', 'all')}
                            />
                            <StatCard
                                icon={<AlertCircle className="h-4 w-4" />}
                                label="Непрочитанные"
                                value={stats.unread}
                                active={currentFilters.category === 'unread'}
                                onClick={() => handleFilterChange('category', 'unread')}
                                variant="warning"
                            />
                        </div>
                    )}

                    {/* Search */}
                    <div className="border-b p-3">
                        <form onSubmit={handleSearch}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Найти диалоги"
                                    className="pl-10"
                                />
                            </div>
                        </form>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto">
                        {chats.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground p-4">
                                <p className="text-sm">Нет чатов</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {chats
                                    .filter(c => {
                                        // Filter by search
                                        if (currentFilters.search) {
                                            const query = currentFilters.search.toLowerCase();
                                            const matchesSearch = (
                                                c.client?.name?.toLowerCase().includes(query) ||
                                                c.client?.phone?.toLowerCase().includes(query) ||
                                                c.client?.email?.toLowerCase().includes(query) ||
                                                c.latest_message?.[0]?.content?.toLowerCase().includes(query)
                                            );
                                            if (!matchesSearch) return false;
                                        }
                                        
                                        return true;
                                    })
                                    .map((c) => (
                                        <ChatListItem key={c.id} chat={c} isActive={c.id === chat.id} filters={currentFilters} />
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center - Chat Area */}
                <div className="flex-1 flex flex-col min-h-0">
                {hasNoChats ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">Нет чатов</p>
                        </div>
                    </div>
                ) : (
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
                    className="flex flex-1 flex-col min-h-0"
                >
                    {/* Scrollable area: header + messages share the same scroll container */}
                    <div className="flex-1 min-h-0 overflow-auto">
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
                        <div className="p-4 pb-40">
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <MessageBubble key={msg.id} message={msg} />
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>

                    {/* Input */}
                    <div className="border-t bg-background">
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
                </div>
                )}
                </div>

                {/* Right Sidebar - Client Card */}
                {!hasNoChats && (
                <div className="w-80 border-l bg-background flex flex-col">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold">Карточка клиента</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={chat.client?.avatar} />
                                    <AvatarFallback>
                                        <UserIcon className="h-10 w-10" />
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="font-medium">
                                    {chat.client?.name || 'Без имени'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {chat.status === 'open' ? 'Чат открыт' : statusLabels[chat.status] || 'Чат закрыт'}
                                </p>
                            </div>

                            <div className="space-y-2 text-sm">
                                {chat.client?.phone && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Телефон</p>
                                        <p className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <span>{chat.client.phone}</span>
                                        </p>
                                    </div>
                                )}

                                {chat.client?.email && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                                        <p className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <span>{chat.client.email}</span>
                                        </p>
                                    </div>
                                )}
                                
                                {chat.client?.metadata && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Логин клиента</p>
                                        <p>{String(chat.client.metadata.telegram_username || chat.client.metadata.login || '—')}</p>
                                    </div>
                                )}
                            </div>

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
                                            <div className="space-y-1">
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

                            {/* Tickets Section */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Тикеты</p>
                                <p className="text-sm text-muted-foreground">Нет тикетов</p>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </AppLayout>
    );
}

function StatCard({
    icon,
    label,
    value,
    active,
    onClick,
    variant = 'default',
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    active?: boolean;
    onClick?: () => void;
    variant?: 'default' | 'warning';
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                active
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-muted'
            } ${variant === 'warning' && value > 0 ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : ''}`}
        >
            {icon}
            <span className="font-medium">{label}</span>
            <Badge variant={active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{value}</Badge>
        </button>
    );
}

function ChatListItem({ chat, isActive, filters }: { chat: Chat; isActive: boolean; filters?: any }) {
    const lastMessage = chat.latest_message?.[0];
    const channelIcon = channelIcons[chat.channel?.type || 'web'] || '💬';
    
    // Build URL with filters
    const chatUrl = filters 
        ? `/chats/${chat.id}?${new URLSearchParams(
            Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
        ).toString()}`
        : `/chats/${chat.id}`;

    return (
        <Link
            href={chatUrl}
            className={`flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors ${
                isActive ? 'bg-primary/10 border-l-2 border-l-primary' : ''
            }`}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    {chat.client?.avatar ? (
                        <img
                            src={chat.client.avatar}
                            alt={chat.client.name || ''}
                            className="h-full w-full rounded-full object-cover"
                        />
                    ) : (
                        <UserLucide className="h-6 w-6 text-muted-foreground" />
                    )}
                </div>
                {/* Channel indicator */}
                <span className="absolute -bottom-1 -right-1 text-xs bg-background rounded-full p-0.5">
                    {channelIcon}
                </span>
                {/* Status indicator */}
                {chat.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                        {chat.unread_count > 9 ? '9+' : chat.unread_count}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                        {chat.client?.name || chat.client?.phone || `Клиент #${chat.client_id}`}
                    </span>
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColors[chat.status] || 'bg-gray-400'}`} />
                </div>
                <p className="truncate text-xs text-muted-foreground mb-1">
                    {lastMessage?.content || 'Нет сообщений'}
                </p>
                {chat.client?.tags && chat.client.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {chat.client.tags.map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0.5 rounded-md font-normal"
                                style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}
                            >
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Meta */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {chat.last_message_at && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(chat.last_message_at), {
                            addSuffix: false,
                            locale: ru,
                        })}
                    </span>
                )}
            </div>
        </Link>
    );
}

function MessageBubble({ message }: { message: Message }) {
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

                {message.attachments?.map((att, i) => {
                    const a: any = att;
                    const url = a.url || (att.path ? `/storage/${att.path}` : null);
                    const type = a.type || message.type || '';

                    if (!url) return null;

                    if (type === 'image') {
                        return (
                            <img
                                key={i}
                                src={url}
                                alt={att.name || 'image'}
                                className="max-h-60 rounded mb-2"
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

                    // default: treat as downloadable file
                    const fileName = att.name || a.filename || (att.path ? att.path.split('/').pop() : url.split('/').pop());
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
