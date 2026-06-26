'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
      {
        href: '/cases/new',
        label: 'New Case',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        href: '/search',
        label: 'Case Search',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ),
      },
      {
        href: '/feed',
        label: 'Discovery Feed',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
      },
      {
        href: '/research',
        label: 'Research',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Network',
    items: [
      {
        href: '/collaborations',
        label: 'Collaborations',
        badgeKey: 'collaborations',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        href: '/experts',
        label: 'Experts',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21a8 8 0 1 0-16 0" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Institution',
    items: [
      {
        href: '/hospital',
        label: 'Hospital Insights',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        ),
      },
      {
        href: '/notifications',
        label: 'Notifications',
        badgeKey: 'notifications',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ),
      },
    ],
  },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [badges, setBadges] = useState({ notifications: 0, collaborations: 0 });

  const expanded = !collapsed || hovered;

  // Redirect to login if no auth
  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  // Fetch badge counts (notifications + pending collaborations)
  useEffect(() => {
    if (!token) return;
    const API = process.env.NEXT_PUBLIC_API_URL;
    const headers = { Authorization: `Bearer ${token}` };

    const fetchBadges = async () => {
      try {
        const [notifRes, collabRes] = await Promise.allSettled([
          fetch(`${API}/notifications?unread=true&limit=1`, { headers }),
          fetch(`${API}/collaborations?status=requested&limit=1`, { headers }),
        ]);

        let notifCount = 0;
        let collabCount = 0;

        if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
          const d = await notifRes.value.json();
          notifCount = d.total ?? d.count ?? (Array.isArray(d) ? d.length : 0);
        }
        if (collabRes.status === 'fulfilled' && collabRes.value.ok) {
          const d = await collabRes.value.json();
          collabCount = d.total ?? d.count ?? (Array.isArray(d) ? d.length : 0);
        }

        setBadges({ notifications: notifCount, collaborations: collabCount });
      } catch {
        // silently ignore
      }
    };

    fetchBadges();
  }, [token]);

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };

  // Derive display name and initials from user object
  const displayName = user?.full_name || user?.name || 'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const role = user?.specialty || user?.role || '';
  const hospital = user?.hospital_name || '';
  const subLine = [role, hospital].filter(Boolean).join(' · ');

  if (!token) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--lavender-50)' }}>
      {/* ── SIDEBAR ── */}
      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => collapsed && setHovered(false)}
        style={{
          width: expanded ? 228 : 64,
          minHeight: '100vh',
          background: 'var(--white)',
          borderRight: '1px solid var(--lavender-100)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 40,
          transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
          overflow: 'hidden',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              border: '2px solid var(--lavender-400)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lavender-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            {expanded && (
              <span style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: 16, fontWeight: 700,
                color: 'var(--navy)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.15s',
              }}>
                MediData
              </span>
            )}
            <button
              onClick={() => { setCollapsed(c => !c); setHovered(false); }}
              style={{
                marginLeft: 'auto',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.15s',
              }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {collapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
          </div>

          {/* Nav sections */}
          {NAV_ITEMS.map(({ section, items }) => (
            <div key={section}>
              {expanded && (
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '0 10px', marginBottom: 4, marginTop: 16,
                  whiteSpace: 'nowrap',
                }}>
                  {section}
                </div>
              )}
              {!expanded && <div style={{ height: 16 }} />}
              {items.map(({ href, label, icon, badgeKey }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                const badgeCount = badgeKey ? badges[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={!expanded ? label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: 10,
                      padding: expanded ? '9px 10px' : '9px 0',
                      justifyContent: expanded ? 'flex-start' : 'center',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 13.5, fontWeight: 500,
                      color: isActive ? 'var(--lavender-700)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--lavender-50)' : 'transparent',
                      textDecoration: 'none',
                      marginBottom: 2,
                      transition: 'all 0.13s',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--lavender-50)'; e.currentTarget.style.color = 'var(--navy)'; }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                  >
                    <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {icon}
                    </span>
                    {expanded && <span style={{ flex: 1 }}>{label}</span>}
                    {expanded && badgeCount > 0 && (
                      <span style={{
                        background: 'var(--lavender-600)', color: 'white',
                        fontSize: 10, fontWeight: 700,
                        minWidth: 18, height: 18, borderRadius: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 5px',
                      }}>
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom: user + sign out */}
        <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid var(--lavender-100)', flexShrink: 0 }}>
          <button
            onClick={handleSignOut}
            title={!expanded ? 'Sign Out' : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.13s',
              marginBottom: 8,
              justifyContent: expanded ? 'flex-start' : 'center',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fce4ec'; e.currentTarget.style.color = '#c62828'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {expanded && <span>Sign Out</span>}
          </button>

          {/* User card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            justifyContent: expanded ? 'flex-start' : 'center',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--lavender-50)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--lavender-400), var(--lavender-700))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>
              {initials}
            </div>
            {expanded && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {subLine && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subLine}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        marginLeft: collapsed ? 64 : 228,
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.22s cubic-bezier(.4,0,.2,1)',
      }}>
        {children}
      </main>
    </div>
  );
}