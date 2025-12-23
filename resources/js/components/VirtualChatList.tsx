import { type Chat } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef } from 'react';
import ChatListItem from './ChatListItem';

interface VirtualChatListProps {
    chats: Chat[];
    activeChatId: number;
    filters: Record<string, any>;
    onMarkAsUnread: (chatId: number, e: React.MouseEvent) => void;
}

const ITEM_HEIGHT = 90; // Approximate height of each chat item

export default function VirtualChatList({
    chats,
    activeChatId,
    filters,
    onMarkAsUnread
}: VirtualChatListProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: chats.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ITEM_HEIGHT,
        overscan: 5, // Render 5 extra items above and below viewport
    });

    if (chats.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Нет чатов
            </div>
        );
    }

    return (
        <div
            ref={parentRef}
            className="flex-1 overflow-auto"
            style={{ contain: 'strict' }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const chatItem = chats[virtualItem.index];
                    return (
                        <div
                            key={chatItem.id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <ChatListItem
                                chatItem={chatItem}
                                isActive={chatItem.id === activeChatId}
                                filters={filters}
                                onMarkAsUnread={onMarkAsUnread}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
