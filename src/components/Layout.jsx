import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  QrCode, ClipboardList, BarChart2, MessageSquare,
  ShieldCheck, Settings, LogOut, Menu, ChevronDown, UsersRound, X,
  User as UserIcon, Info, Calendar, Clock
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
    hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Manila',
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
  const roleLabel = isAdmin ? 'Admin' : isTeacher ? 'Teacher' : 'Staff';

  useEffect(() => {
    const clockInterval = window.setInterval(() => setNow(new Date()), 60000);
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

        <header className="app-topbar app-header">
          <button
            type="button"
            className="app-topbar__menu"
            onClick={() => setSidebarOpen((isOpen) => !isOpen)}
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="app-header__left">
            <div className="app-header__school">
              <strong className="app-header__name">Looc National High School</strong>
              <span className="app-header__motto">Discipline Builds Tomorrow</span>
            </div>
          </div>

          <div className="app-topbar__right app-header__right">
            <div className="app-header__datetime" aria-label="Current date and time in Asia/Manila">
              <span className="app-header__time-item"><Calendar size={14} aria-hidden="true" />{dayDate}</span>
              <span className="app-header__time-item"><Clock size={14} aria-hidden="true" />{time}</span>
            </div>

            <span className="app-header__divider app-header__right-divider" aria-hidden="true" />

            <div className="app-topbar__user app-header__user">
              <button
                onClick={() => setUserMenuOpen((isOpen) => !isOpen)}
                className="account-trigger app-header__user-trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${displayName}`}
                type="button"
              >
                <div className="account-trigger-avatar app-header__avatar">
                  {displayName.charAt(0).toUpperCase()}
                  <span className="account-trigger-status" />
                </div>
                <span className="account-trigger-copy app-header__user-info">
                  <strong className="app-header__user-name">{displayName}</strong>
                  <small className="app-header__user-role">{roleLabel}</small>
                </span>
                <ChevronDown size={13} className="account-trigger-chevron" />
              </button>

              {userMenuOpen && (
                <div className="account-menu app-header__dropdown" role="menu">
                  <div className="account-menu__header">
                    <div className="account-menu__name">{displayName}</div>
                    <div className="account-menu__email">{user?.email}</div>
                    <span className="badge badge-navy">{roleLabel}</span>
                  </div>
                  <div className="account-menu__links">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="account-menu-link app-header__dropdown-item"
                      role="menuitem"
                    >
                      <Settings size={14} /> Settings
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="account-menu-link account-menu-link--danger app-header__dropdown-item"
                      role="menuitem"
                    >
                      <LogOut size={14} /> Logout
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
