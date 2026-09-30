import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  QrCode, ClipboardList, BarChart2, MessageSquare,
  ShieldCheck, Settings, LogOut, Menu, ChevronDown, UsersRound, X,
  User as UserIcon, KeyRound, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Alert from './Alert';

const NAV_FULL = [
  { group: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { group: 'School Records', adminOnly: true, items: [
    { to: '/students', label: 'Students', icon: GraduationCap },
    { to: '/teachers', label: 'Teachers', icon: Users },
    { to: '/sections', label: 'Sections', icon: BookOpen },
    { to: '/parents', label: 'Parents', icon: UsersRound },
  ]},
  { group: 'Attendance', items: [
    { to: '/scanner', label: 'QR Scanner', icon: QrCode },
    { to: '/attendance', label: 'Records', icon: ClipboardList },
    { to: '/reports', label: 'Reports', icon: BarChart2 },
  ]},
  { group: 'Logs & Admin', adminOnly: true, items: [
    { to: '/sms-logs', label: 'SMS Logs', icon: MessageSquare },
    { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]},
  { group: 'System', items: [
    { to: '/about', label: 'About', icon: Info },
  ]},
];

function formatClock(date) {
  const time = date.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Manila',
  });
  const dayDate = date.toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    timeZone: 'Asia/Manila',
  });
  return { time, dayDate };
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { user, logout, isAdmin, isTeacher } = useAuth();
  const { error, staffDataError } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const nav = NAV_FULL.filter((section) => !section.adminOnly || isAdmin);
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const roleLabel = isAdmin ? 'Admin' : 'Staff';

  useEffect(() => {
    const clockInterval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const { time, dayDate } = formatClock(now);

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-copy">
            <strong>LNHS</strong>
            <span>Attendance System</span>
          </div>
        </div>

        <nav className="app-sidebar__nav" aria-label="Main navigation">
          {nav.map((section) => (
            <div key={section.group} className="app-sidebar__group">
              <div className="app-sidebar__group-label">{section.group}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `app-sidebar__link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={15} />
                  <span>{item.to === '/dashboard' && isTeacher ? 'My Classes' : item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <div>School ID: 301765</div>
          <div>v2.0 · © LNHS 2026</div>
        </div>
      </aside>

      <div
        className={`app-sidebar-scrim ${sidebarOpen ? 'is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="app-main">
        {/* Institutional strip */}
        <div className="app-gov-strip" role="presentation">
          <span>Republic of the Philippines</span>
          <span className="app-gov-strip__sep">·</span>
          <span>Department of Education</span>
          <span className="app-gov-strip__sep">·</span>
          <span>Official Use Only</span>
        </div>

        <header className="app-topbar">
          <button
            type="button"
            className="app-topbar__menu"
            onClick={() => setSidebarOpen((isOpen) => !isOpen)}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="app-topbar__title">
            <strong>Looc National High School</strong>
            <span>Attendance Monitoring System</span>
          </div>

          <div className="app-topbar__right">
            <div className="app-topbar__clock" aria-label="Current time in Asia/Manila">
              <span className="app-topbar__clock-time">{time}</span>
              <span className="app-topbar__clock-date">{dayDate}</span>
            </div>

            <div className="app-topbar__user">
              <button
                onClick={() => setUserMenuOpen((isOpen) => !isOpen)}
                className="account-trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${displayName}`}
                type="button"
              >
                <div className="account-trigger-avatar">
                  {displayName.charAt(0).toUpperCase()}
                  <span className="account-trigger-status" />
                </div>
                <span className="account-trigger-copy">
                  <strong>{displayName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={13} className="account-trigger-chevron" />
              </button>

              {userMenuOpen && (
                <div className="account-menu">
                  <div className="account-menu__header">
                    <div className="account-menu__name">{displayName}</div>
                    <div className="account-menu__email">{user?.email}</div>
                    <span className="badge badge-navy">{roleLabel}</span>
                  </div>
                  <div className="account-menu__links">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="account-menu-link"
                    >
                      <UserIcon size={14} /> Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="account-menu-link"
                    >
                      <KeyRound size={14} /> Change Password
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="account-menu-link account-menu-link--danger"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-content" onClick={() => setUserMenuOpen(false)}>
          {error && !error.includes('fetch') && !error.includes('Failed to fetch') && (
            <Alert type="warn" className="mb-4">
              <div>Live data refresh failed — showing last known state.</div>
              <small>{error}</small>
            </Alert>
          )}
          {staffDataError && (
            <Alert type="warn" className="mb-4">
              Admin data refresh failed: {staffDataError}
            </Alert>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
