import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Bell, BookOpen, CalendarDays, ClipboardList, ExternalLink, FileText, FolderKanban, HandCoins, HandHeart, HeartHandshake, Image as ImageIcon, Inbox, LayoutDashboard,
  LayoutTemplate, LogOut, Mail, Menu, Navigation, Palette, Repeat, ScrollText, Settings, ShieldCheck, Target, UserCircle, Users, UsersRound, X, type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@ngo/shared';
import { useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { api, send } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relative } from '@/lib/format';
import { Spinner } from '@/components/ui';

interface NavItem { label: string; href: string; icon: LucideIcon; perm?: Permission[] }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, perm: ['dashboard.view'] }, { label: 'Reports', href: '/admin/reports', icon: BarChart3, perm: ['reports.view'] }] },
  {
    group: 'Website',
    items: [
      { label: 'Pages & sections', href: '/admin/website/pages', icon: LayoutTemplate, perm: ['website.pages'] },
      { label: 'Theme & branding', href: '/admin/website/theme', icon: Palette, perm: ['website.theme'] },
      { label: 'Site settings', href: '/admin/website/settings', icon: Settings, perm: ['website.theme'] },
      { label: 'Navigation', href: '/admin/website/navigation', icon: Navigation, perm: ['website.theme'] },
      { label: 'Media library', href: '/admin/media', icon: ImageIcon },
    ],
  },
  {
    group: 'Programmes',
    items: [
      { label: 'Causes', href: '/admin/content/causes', icon: HeartHandshake, perm: ['content.manage'] },
      { label: 'Campaigns', href: '/admin/content/campaigns', icon: Target, perm: ['campaigns.manage'] },
      { label: 'Projects', href: '/admin/content/projects', icon: FolderKanban, perm: ['projects.manage'] },
      { label: 'Events', href: '/admin/content/events', icon: CalendarDays, perm: ['events.manage'] },
      { label: 'Beneficiaries', href: '/admin/beneficiaries', icon: ShieldCheck, perm: ['beneficiaries.view', 'beneficiaries.manage'] },
    ],
  },
  {
    group: 'Fundraising',
    items: [
      { label: 'Donations', href: '/admin/donations', icon: HandCoins, perm: ['donations.view'] },
      { label: 'Donors', href: '/admin/donors', icon: UsersRound, perm: ['donations.view'] },
      { label: 'Monthly giving', href: '/admin/recurring', icon: Repeat, perm: ['donations.view'] },
    ],
  },
  {
    group: 'People',
    items: [
      { label: 'Volunteer applications', href: '/admin/volunteers/applications', icon: ClipboardList, perm: ['volunteers.view', 'volunteers.manage'] },
      { label: 'Volunteers', href: '/admin/volunteers', icon: HandHeart, perm: ['volunteers.view', 'volunteers.manage'] },
      { label: 'Opportunities', href: '/admin/content/opportunities', icon: BookOpen, perm: ['volunteers.manage'] },
      { label: 'Inquiries', href: '/admin/inquiries', icon: Inbox, perm: ['inquiries.manage'] },
      { label: 'Subscribers', href: '/admin/subscribers', icon: Mail, perm: ['inquiries.manage'] },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Blog & news', href: '/admin/content/posts', icon: FileText, perm: ['blog.manage'] },
      { label: 'Stories', href: '/admin/content/stories', icon: BookOpen, perm: ['content.manage'] },
      { label: 'Team & board', href: '/admin/content/team', icon: Users, perm: ['content.manage'] },
      { label: 'More content…', href: '/admin/content/faqs', icon: LayoutTemplate, perm: ['content.manage', 'blog.manage'] },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Email templates', href: '/admin/email', icon: Mail, perm: ['email.templates'] },
      { label: 'Staff users', href: '/admin/users', icon: Users, perm: ['users.manage'] },
      { label: 'Roles & permissions', href: '/admin/roles', icon: ShieldCheck, perm: ['users.manage'] },
      { label: 'Audit log', href: '/admin/audit', icon: ScrollText, perm: ['audit.view'] },
    ],
  },
];

interface Notification { id: string; title: string; body: string; link: string; read: boolean; createdAt: string }

function Notifications() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['admin', 'notifications'], queryFn: () => api<{ data: Notification[]; meta: { unread: number } }>('/admin/notifications'), refetchInterval: 60_000 });
  const unread = data?.meta.unread ?? 0;
  return (
    <div className="relative">
      <button className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button className="text-xs font-semibold text-primary" onClick={async () => { await send('/admin/notifications/read-all'); qc.invalidateQueries({ queryKey: ['admin', 'notifications'] }); }}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {(data?.data ?? []).length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-muted">You’re all caught up.</li>}
            {(data?.data ?? []).map((n) => (
              <li key={n.id} className={cn('border-b border-line/60 last:border-0', !n.read && 'bg-primary/5')}>
                <Link to={n.link || '/admin'} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-surface-alt">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-muted">{relative(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const { user, loading, can, logout } = useAuth();
  const { settings } = useSite();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  useEffect(() => setMobile(false), [location.pathname]);

  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(...i.perm)) })).filter((g) => g.items.length);
  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-heading text-secondary">{settings.organization.name.slice(0, 1)}</span>
        <span className="truncate font-heading text-lg text-white">{settings.organization.shortName || settings.organization.name}</span>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <NavLink end={i.href === '/admin'} to={i.href} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition', isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
                    <i.icon className="h-4 w-4 shrink-0" aria-hidden /> {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-secondary lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-secondary shadow-2xl">
            <button className="absolute right-3 top-4 rounded-full p-2 text-white/80 hover:bg-white/10" onClick={() => setMobile(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur sm:px-8">
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-1">
            <a href="/" target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-muted hover:bg-ink/5 hover:text-ink sm:inline-flex">
              View site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <Notifications />
            <Link to="/admin/account" className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-ink/5" aria-label="My account">
              <UserCircle className="h-6 w-6 text-ink-muted" aria-hidden />
              <span className="hidden text-left text-xs leading-tight sm:block"><span className="block font-semibold">{user.name}</span><span className="text-ink-muted">{user.role.name}</span></span>
            </Link>
            <button onClick={logout} className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main id="main"><Outlet /></main>
      </div>
    </div>
  );
}
