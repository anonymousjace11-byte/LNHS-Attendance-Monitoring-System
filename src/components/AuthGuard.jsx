import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps protected routes. Redirects to /login if no session.
 * Optionally enforces a role: 'admin' | 'teacher' | 'staff'
 */
export default function AuthGuard({ children, requireRole }) {
  const { user, isAdmin, isTeacher, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}>Checking secure session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleDenied = requireRole === 'admin'
    ? !isAdmin
    : requireRole === 'teacher'
      ? !isTeacher
      : requireRole === 'staff'
        ? !isAdmin && !isTeacher
        : false;

  if (roleDenied) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <div className="card p-8 text-center" style={{ maxWidth: 380 }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#fee2e2' }}>
            <span style={{ fontSize: '1.5rem' }}>🔒</span>
          </div>
          <h2 className="page-title mb-2" style={{ fontSize: '1.1rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>
            You do not have permission to view this page. Contact the school administrator.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
