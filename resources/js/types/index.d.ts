import { InertiaLinkProps } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    sidebarOpen: boolean;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    role?: 'admin' | 'operator' | 'viewer';
    qualification?: number;
    max_chats?: number;
    is_online?: boolean;
    last_seen_at?: string | null;
    created_at: string;
    updated_at: string;
    assigned_chats_count?: number;
    operator_groups?: OperatorGroup[];
    [key: string]: unknown;
}

export interface Channel {
    id: number;
    name: string;
    type: 'telegram' | 'whatsapp' | 'instagram' | 'facebook' | 'vk' | 'viber' | 'email' | 'web';
    is_active: boolean;
    credentials?: {
        bot_token?: string;
        bot_username?: string;
        bot_id?: number;
    };
    settings?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    chats_count?: number;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface Client {
    id: number;
    external_id?: string;
    name?: string;
    phone?: string;
    email?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
    notes?: string;
    tags?: Tag[];
    created_at: string;
    updated_at: string;
    chats_count?: number;
    display_name?: string;
}

export interface Chat {
    id: number;
    channel_id: number;
    client_id: number;
    operator_id?: number;
    status: 'new' | 'open' | 'pending' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    subject?: string;
    last_message_at?: string;
    unread_count: number;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    channel?: Channel;
    client?: Client;
    operator?: User;
    messages?: Message[];
    latest_message?: Message[];
}

export interface Message {
    id: number;
    chat_id: number;
    channel_id: number;
    client_id?: number;
    operator_id?: number;
    external_id?: string;
    direction: 'incoming' | 'outgoing';
    type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'location' | 'contact' | 'sticker';
    content?: string;
    attachments?: Attachment[];
    metadata?: Record<string, unknown>;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    reply_to_id?: number;
    read_at?: string;
    created_at: string;
    updated_at: string;
    operator?: User;
    client?: Client;
    reply_to?: Message;
}

export interface Attachment {
    path: string;
    name: string;
    mime: string;
    size: number;
    // optional fields used in various places
    url?: string;
    type?: string; // 'image' | 'video' | 'file' ...
    filename?: string;
}

export interface QuickReply {
    id: number;
    user_id?: number;
    title: string;
    content: string;
    shortcut?: string;
    category?: string;
    is_global: boolean;
    usage_count: number;
    created_at: string;
    updated_at: string;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
    description?: string;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface AutomationStep {
    id: number;
    automation_id: number;
    step_id: string;
    type: 'send_text' | 'send_image' | 'send_video' | 'send_file' | 'delay' | 'condition' | 'assign_operator' | 'add_tag' | 'remove_tag' | 'close_chat';
    config?: Record<string, unknown>;
    position?: { x: number; y: number };
    order: number;
    next_step_id?: string;
    condition_true_step_id?: string;
    condition_false_step_id?: string;
    created_at: string;
    updated_at: string;
}

export interface Automation {
    id: number;
    name: string;
    description?: string;
    channel_id?: number;
    trigger: 'new_chat' | 'keyword' | 'no_response' | 'scheduled';
    trigger_config?: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    channel?: Channel;
    steps?: AutomationStep[];
    logs_count?: number;
}

export interface ChatStats {
    new: number;
    open: number;
    pending: number;
    resolved: number;
    unassigned: number;
}

export interface OperatorGroup {
    id: number;
    name: string;
    color: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    operators_count?: number;
    operators?: (User & { pivot?: { is_supervisor: boolean } })[];
}
