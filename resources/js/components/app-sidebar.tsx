import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import {
    LayoutGrid,
    MessageSquare,
    Users,
    Bot,
    UserCog,
    Zap,
    BarChart3,
    Settings,
    Tags,
    Workflow,
} from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Дашборд',
        href: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Чаты',
        href: '/chats',
        icon: MessageSquare,
    },
    {
        title: 'Клиенты',
        href: '/clients',
        icon: Users,
    },
    {
        title: 'Теги',
        href: '/tags',
        icon: Tags,
    },
    {
        title: 'Автоматизации',
        href: '/automations',
        icon: Workflow,
    },
    {
        title: 'Telegram боты',
        href: '/channels',
        icon: Bot,
    },
    {
        title: 'Операторы',
        href: '/operators',
        icon: UserCog,
    },
    {
        title: 'Быстрые ответы',
        href: '/quick-replies',
        icon: Zap,
    },
    {
        title: 'Аналитика',
        href: '/analytics',
        icon: BarChart3,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Настройки',
        href: '/settings/profile',
        icon: Settings,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
