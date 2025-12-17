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
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
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
    Mail,
} from 'lucide-react';
import AppLogo from './app-logo';

// All navigation items with role restrictions
// If roles is undefined, item is visible to all
const allNavItems: (NavItem & { roles?: ('admin' | 'operator' | 'viewer')[] })[] = [
    {
        title: 'Дашборд',
        href: '/dashboard',
        icon: LayoutGrid,
        roles: ['admin'],
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
        roles: ['admin'],
    },
    {
        title: 'Теги',
        href: '/tags',
        icon: Tags,
        roles: ['admin'],
    },
    {
        title: 'Автоматизации',
        href: '/automations',
        icon: Workflow,
        roles: ['admin'],
    },
    {
        title: 'Telegram боты',
        href: '/channels',
        icon: Bot,
        roles: ['admin'],
    },
    {
        title: 'Операторы',
        href: '/operators',
        icon: UserCog,
        roles: ['admin'],
    },
    {
        title: 'Быстрые ответы',
        href: '/quick-replies',
        icon: Zap,
        roles: ['admin'],
    },
    {
        title: 'Рассылки',
        href: '/broadcasts/create',
        icon: Mail,
    },
    {
        title: 'Аналитика',
        href: '/analytics',
        icon: BarChart3,
        roles: ['admin'],
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
    const { auth } = usePage<SharedData>().props;
    const userRole = auth.user?.role || 'operator';

    // Filter nav items based on user role
    const mainNavItems = allNavItems.filter(item => {
        if (!item.roles) return true; // No restriction, show to all
        return item.roles.includes(userRole);
    });

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
