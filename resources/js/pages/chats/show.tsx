import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
    chat: Chat;
    allTags: Tag[];
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

export default function ChatShow({ chat, allTags }: Props) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatColumnRef = useRef<HTMLDivElement | null>(null);
    const [footerStyle, setFooterStyle] = useState<{ left?: number; width?: number }>({});
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [clientTags, setClientTags] = useState<Tag[]>(chat.client?.tags || []);
    const [tagsOpen, setTagsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>(chat.messages || []);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Чаты', href: '/chats' },
        { title: chat.client?.name || `Чат #${chat.id}`, href: `/chats/${chat.id}` },
    ];

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
        window.addEventListener('scroll', updatePositions, true);

        return () => {
            window.removeEventListener('resize', updatePositions);
            window.removeEventListener('scroll', updatePositions, true);
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || sending) return;

        setSending(true);
        try {
            const response = await fetch(`/chats/${chat.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ content: message }),
            });

            if (response.ok) {
                const newMessage = await response.json();
                setMessages((prev) => [...prev, newMessage]);
                setMessage('');
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

    const handleStatusChange = (status: string) => {
        router.post(`/chats/${chat.id}/status`, { status }, { preserveScroll: true });
    };

    const handlePriorityChange = (priority: string) => {
        router.post(`/chats/${chat.id}/priority`, { priority }, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={chat.client?.name || `Чат #${chat.id}`} />
            <div className="flex h-full min-h-0">
                {/* Chat Area */}
                <div ref={(el) => { if (el) chatColumnRef.current = el }} className="flex flex-1 flex-col min-h-0 h-screen">
                    {/* Scrollable area: header + messages share the same scroll container */}
                    <div className="flex-1 min-h-0 overflow-auto">
                        {/* Header (sticky inside scroll container) */}
                        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
                            <div className="flex items-center gap-4 p-4">
                                <Button variant="ghost" size="icon" asChild>
                                    <a href="/chats">
                                        <ArrowLeft className="h-4 w-4" />
                                    </a>
                                </Button>

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
                    <div
                        className="fixed bottom-0 z-50 bg-background/95 border-t backdrop-blur-sm"
                        style={{
                            left: footerStyle.left ? `${footerStyle.left}px` : 0,
                            width: footerStyle.width ? `${footerStyle.width}px` : '100%'
                        }}
                    >
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

                {/* Sidebar - Client Info */}
                <div className="w-80 border-l bg-muted/30">
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

                            {chat.client?.notes && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Заметки</p>
                                    <p className="text-sm">{chat.client.notes}</p>
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
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function MessageBubble({ message }: { message: Message }) {
    const isOutgoing = message.direction === 'outgoing';

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

    return (
        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isOutgoing
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
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

                {message.type === 'image' && message.attachments?.map((att, i) => (
                    <img
                        key={i}
                        src={`/storage/${att.path}`}
                        alt={att.name}
                        className="max-h-60 rounded"
                    />
                ))}

                {message.type === 'file' && message.attachments?.map((att, i) => (
                    <a
                        key={i}
                        href={`/storage/${att.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 underline"
                    >
                        <Paperclip className="h-4 w-4" />
                        {att.name}
                    </a>
                ))}

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
