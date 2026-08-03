"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
  {
    href: "/feed",
    label: "Discovery Feed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Case Search",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/cases",
    label: "New Case",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/research",
    label: "Research",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
  },
  {
    href: "/collaborations",
    label: "Collaborations",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
    ),
  },
  {
    href: "/experts",
    label: "Experts",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
  },
  {
    href: "/hospital",
    label: "Hospital",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem("medidata_token");
    localStorage.removeItem("medidata_user");
    // Clear zustand store cookie
    document.cookie = "medidata_token=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <>
      <style>{`
        .sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: ${collapsed ? "64px" : "220px"};
          background: var(--navy);
          display: flex;
          flex-direction: column;
          z-index: 50;
          transition: width 0.25s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
        }
        .sidebar__logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: ${collapsed ? "20px 0" : "20px 20px"};
          justify-content: ${collapsed ? "center" : "flex-start"};
          border-bottom: 1px solid rgba(255,255,255,0.07);
          min-height: 64px;
          flex-shrink: 0;
          text-decoration: none;
        }
        .sidebar__logo-text {
          font-family: 'Sora', sans-serif;
          font-weight: 700;
          font-size: 17px;
          color: white;
          white-space: nowrap;
          opacity: ${collapsed ? 0 : 1};
          transition: opacity 0.15s;
          pointer-events: none;
        }
        .sidebar__toggle {
          position: absolute;
          top: 18px;
          right: ${collapsed ? "-14px" : "-14px"};
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--lavender-600);
          border: 2px solid var(--navy);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: white;
          transition: background 0.2s;
          z-index: 60;
        }
        .sidebar__toggle:hover { background: var(--lavender-500); }
        .sidebar__nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 0;
        }
        .sidebar__nav::-webkit-scrollbar { width: 3px; }
        .sidebar__nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .sidebar__nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: ${collapsed ? "10px 0" : "10px 20px"};
          justify-content: ${collapsed ? "center" : "flex-start"};
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          border-radius: 0;
          transition: color 0.2s, background 0.2s;
          white-space: nowrap;
          position: relative;
        }
        .sidebar__nav-item:hover {
          color: white;
          background: rgba(255,255,255,0.07);
        }
        .sidebar__nav-item.active {
          color: white;
          background: rgba(92,107,192,0.3);
          border-left: 3px solid var(--lavender-400);
        }
        .sidebar__nav-label {
          opacity: ${collapsed ? 0 : 1};
          transition: opacity 0.12s;
          pointer-events: none;
        }
        .sidebar__tooltip {
          display: none;
          position: absolute;
          left: 70px;
          background: var(--lavender-700);
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
        }
        ${collapsed ? ".sidebar__nav-item:hover .sidebar__tooltip { display: block; }" : ""}
        .sidebar__bottom {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 12px 0;
          flex-shrink: 0;
        }
        .sidebar__signout {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: ${collapsed ? "10px 0" : "10px 20px"};
          justify-content: ${collapsed ? "center" : "flex-start"};
          color: rgba(255,255,255,0.45);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          width: 100%;
          transition: color 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .sidebar__signout:hover {
          color: #ef9a9a;
          background: rgba(239,154,154,0.08);
        }
        .sidebar__signout-label {
          opacity: ${collapsed ? 0 : 1};
          transition: opacity 0.12s;
        }
      `}</style>

      <aside className="sidebar">
        {/* Logo */}
        <Link href="/dashboard" className="sidebar__logo">
          <svg width="28" height="28" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="34" height="34" rx="9" fill="rgba(92,107,192,0.5)" />
            <path d="M10 17h4l2-6 3 12 2-6h3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="24" cy="11" r="2.5" fill="white" opacity="0.7"/>
          </svg>
          <span className="sidebar__logo-text">MediData</span>
        </Link>

        {/* Collapse toggle */}
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Nav items */}
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar__nav-item ${isActive ? "active" : ""}`}
              >
                {item.icon}
                <span className="sidebar__nav-label">{item.label}</span>
                {collapsed && <span className="sidebar__tooltip">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: sign out */}
        <div className="sidebar__bottom">
          <button className="sidebar__signout" onClick={handleSignOut}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            <span className="sidebar__signout-label">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}