import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import schoolSeal from '../imports/LNHS LOGO.png';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  QrCode, ClipboardList, BarChart2, MessageSquare,
  AlertTriangle, ShieldCheck, Settings, LogOut, Menu, ChevronDown, ChevronRight, UsersRound, X,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import AccountModal from './AccountModal';

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

function AppToast({ notification, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notification.id), 8000);
    return () => window.clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <section className={`app-toast app-toast--${notification.type}`} role="alert" aria-live="assertive">
      <span className="app-toast__icon"><AlertTriangle size={17} aria-hidden="true" /></span>
      <div className="app-toast__body">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
        {notification.details && (
          <details className="app-toast__details">
            <summary>Technical details</summary>
            <p>{notification.details}</p>
          </details>
        )}
      </div>
      <button type="button" className="app-toast__close" onClick={() => onDismiss(notification.id)} aria-label="Dismiss notification">
        <X size={15} aria-hidden="true" />
      </button>
    </section>
  );
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
  const nextNotificationId = useRef(0);
  const { user, logout, isAdmin, isTeacher } = useAuth();
  const { error, staffDataError } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const nav = NAV_FULL.filter((section) => !section.adminOnly || isAdmin);
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const roleLabel = isAdmin ? 'School administrator' : isTeacher ? 'Teacher' : 'Staff';
  const avatarInitials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
  const avatarUrl = user?.photoURL || user?.photoUrl || '';

  useEffect(() => {
    const handleNotification = (event) => {
      const notification = event.detail || {};
      setNotifications((current) => [...current, {
        id: ++nextNotificationId.current,
        type: notification.type === 'warning' ? 'warning' : 'error',
        title: notification.title || 'Action could not be completed',
        message: notification.message || 'Please try again.',
        details: notification.details || '',
      }].slice(-3));
    };
    window.addEventListener('school-app:notification', handleNotification);
    return () => window.removeEventListener('school-app:notification', handleNotification);
  }, []);

  useEffect(() => {
    if (!staffDataError) return;
    setNotifications((current) => [...current, {
      id: ++nextNotificationId.current,
      type: 'warning',
      title: 'Some school data could not refresh',
      message: 'You can continue, but some records may be out of date.',
      details: staffDataError,
    }].slice(-3));
  }, [staffDataError]);

  useEffect(() => {
    if (!error || error.includes('fetch') || error.includes('Failed to fetch')) return;
    setNotifications((current) => [...current, {
      id: ++nextNotificationId.current,
      type: 'warning',
      title: 'Live attendance data could not refresh',
      message: 'The displayed attendance records may be out of date.',
      details: error,
    }].slice(-3));
  }, [error]);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
    {accountModalOpen && <AccountModal onClose={() => setAccountModalOpen(false)} />}
      <div className="app-toast-stack" aria-label="System notifications">
        {notifications.map((notification) => (
          <AppToast
            key={notification.id}
            notification={notification}
            onDismiss={(id) => setNotifications((current) => current.filter((item) => item.id !== id))}
          />
        ))}
      </div>
      <aside className={`app-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo">
            <img src={schoolSeal} alt="Looc National High School seal" />
          </div>
          <div className="app-sidebar__brand-copy">
            <strong>LNHS</strong>
            <span>Attendance System</span>
          </div>
        </div>

        <nav className="app-sidebar__nav" aria-label="Main navigation">
          {nav.map((section) => (
            <div key={section.group} className="app-sidebar__group">
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
            <img className="app-header__seal" src={schoolSeal} alt="" />
            <div className="app-header__school">
              <strong className="app-header__name">Looc National High School</strong>
              <span className="app-header__motto">Discipline Builds Tomorrow</span>
            </div>
          </div>

          <div className="app-topbar__right app-header__right">
            <div className="app-topbar__user app-header__user">
              <button
                onClick={() => setUserMenuOpen((isOpen) => !isOpen)}
                className="account-trigger app-header__user-trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Account menu for ${displayName}`}
                title="Account options"
                type="button"
              >
                <div className="account-trigger-avatar app-header__avatar">
                  {avatarUrl
                    ? <img className="account-trigger-avatar__image" src={avatarUrl} alt="" />
                    : <span>{avatarInitials}</span>}
                </div>
                <span className="account-trigger-copy app-header__user-info">
                  <strong className="app-header__user-name">{displayName}</strong>
                  <small className="app-header__user-role">{roleLabel}</small>
                </span>
                <ChevronDown size={13} className="account-trigger-chevron" />
              </button>

              {userMenuOpen && (
                <div className="account-menu app-header__dropdown" role="menu">
                  <div className="account-menu__header app-account-menu__header">
                    <div className="account-menu__profile">
                      <div className="account-menu__avatar">
                        {avatarUrl
                          ? <img src={avatarUrl} alt="" />
                          : <span>{avatarInitials}</span>}
                      </div>
                      <div className="account-menu__identity">
                        <span className="account-menu__greeting">Welcome back</span>
                        <div className="account-menu__name">{displayName}</div>
                      </div>
                    </div>
                    <div className="app-account-menu__details">
                      <div className="account-menu__email">{user?.email}</div>
                      <span className="badge badge-navy app-account-menu__role"><ShieldCheck size={13} aria-hidden="true" />{roleLabel}</span>
                    </div>
                  </div>
                  <div className="account-menu__links">
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); setAccountModalOpen(true); }}
                      className="app-account-menu__action"
                      role="menuitem"
                    >
                      <span className="app-account-menu__action-icon"><Settings size={16} aria-hidden="true" /></span>
                      <span className="app-account-menu__action-copy">
                        <strong>Manage account</strong>
                        <small>School settings and preferences</small>
                      </span>
                      <ChevronRight className="app-account-menu__action-chevron" size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="app-account-menu__action app-account-menu__action--signout"
                      role="menuitem"
                    >
                      <span className="app-account-menu__action-icon"><LogOut size={16} aria-hidden="true" /></span>
                      <span className="app-account-menu__action-copy"><strong>Sign out</strong></span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`app-content${location.pathname === '/settings' ? ' app-content--settings' : ''}${location.pathname === '/students' ? ' app-content--students' : ''}`} onClick={() => setUserMenuOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}
