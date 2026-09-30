import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Sections from './pages/Sections';
import Scanner from './pages/Scanner';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import SmsLogs from './pages/SmsLogs';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Parents from './pages/Parents';
import TeacherPortal from './pages/TeacherPortal';
import About from './pages/About';
import Home from './pages/Home';
import { useAuth } from './context/AuthContext';

function AppShell() {
  const { isTeacher } = useAuth();
  return (
    <AuthGuard>
      <Layout>
        <Routes>
          <Route path="/dashboard" element={isTeacher ? <Navigate to="/teacher-portal" replace /> : <Dashboard />} />
          <Route path="/teacher-portal" element={<AuthGuard requireRole="teacher"><TeacherPortal /></AuthGuard>} />
          <Route path="/students" element={<AuthGuard requireRole="admin"><Students /></AuthGuard>} />
          <Route path="/teachers" element={<AuthGuard requireRole="admin"><Teachers /></AuthGuard>} />
          <Route path="/sections" element={<AuthGuard requireRole="admin"><Sections /></AuthGuard>} />
          <Route path="/parents" element={<AuthGuard requireRole="admin"><Parents /></AuthGuard>} />
          <Route path="/scanner" element={<AuthGuard requireRole="staff"><Scanner /></AuthGuard>} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/sms-logs" element={<AuthGuard requireRole="admin"><SmsLogs /></AuthGuard>} />
          <Route path="/sms" element={<AuthGuard requireRole="admin"><SmsLogs /></AuthGuard>} />
          <Route path="/audit-logs" element={<AuthGuard requireRole="admin"><AuditLogs /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard requireRole="admin"><Settings /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}