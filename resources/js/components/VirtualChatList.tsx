import { type Chat } from '@/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useRef, useCallback } from 'react';
import ChatListItem from './ChatListItem';

interface VirtualChatListProps {
    chats: Chat[];
    activeChatId: number;
    filters: Record<string, any>;
    onMarkAsUnread: (chatId: number, e: React.MouseEvent) => void;
}

// Estimate height based on whether chat has tags
function estimateItemHeight(chat: Chat): number {
    const baseHeight = 76; // Base height without tags
    const tagRowHeight = 28; // Height for tags row
    const hasTags = chat.client?.tags && chat.client.tags.length > 0;
    return hasTags ? baseHeight + tagRowHeight : baseHeight;
}

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
        estimateSize: useCallback((index: number) => estimateItemHeight(chats[index]), [chats]),
        overscan: 5, // Render 5 extra items above and below viewport
        measureElement: (element) => {
            // Measure actual element height for accurate positioning
            return element.getBoundingClientRect().height;
        },
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
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
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

