import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Chat, type Tag } from '@/types';
import { MoreVertical, User as UserIcon, MailOpen } from 'lucide-react';
import React, { memo } from 'react';

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

interface ChatListItemProps {
    chatItem: Chat;
    isActive: boolean;
    filters: Record<string, any>;
    onMarkAsUnread: (chatId: number, e: React.MouseEvent) => void;
}

const ChatListItem = memo(function ChatListItem({
    chatItem,
    isActive,
    filters,
    onMarkAsUnread
}: ChatListItemProps) {
    const hasUnread = chatItem.unread_count > 0;

    // latestMessage приходит как массив из-за HasMany в модели
    const latestMsg = Array.isArray(chatItem.latest_message)
        ? chatItem.latest_message[0]
        : chatItem.latest_message;

    return (
        <div className="relative group border-b">
            <a
                href={`/chats/${chatItem.id}?${new URLSearchParams(filters as any).toString()}`}
                className={`block p-4 hover:bg-accent/50 transition-colors ${isActive ? 'bg-accent' : hasUnread ? 'bg-blue-50 dark:bg-blue-950/20' : ''
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
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`font-medium truncate ${hasUnread ? 'font-semibold' : ''
                                    }`}>
                                    {chatItem.client?.name || `Клиент #${chatItem.client_id}`}
                                </span>
                                {chatItem.is_duplicate && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                                        Дубль чат
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                    {chatItem.last_message_at
                                        ? new Date(chatItem.last_message_at).toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })
                                        : ''}
                                </span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => onMarkAsUnread(chatItem.id, e)}>
                                            <MailOpen className="h-4 w-4 mr-2" />
                                            Непрочитанное
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate flex-1 ${hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
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
                                {chatItem.client.tags.map((tag: Tag) => (
                                    <Badge
                                        key={tag.id}
                                        variant="secondary"
                                        className="text-xs px-1.5 py-0 h-5"
                                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                    >
                                        {tag.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </a>
        </div>
    );
});

export default ChatListItem;
