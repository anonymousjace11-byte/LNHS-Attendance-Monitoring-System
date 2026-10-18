import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MessageSquare,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Alert from '../components/Alert';
import FormField from '../components/FormField';
import lnhsLogo from '../imports/LNHS LOGO.png';
import lnhsBanner from '../imports/lnhs-banner.png';

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function validatePassword(value) {
  return value.length >= 6;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const emailInvalid = (touched.email || submitted) && !validateEmail(email);
  const passwordInvalid = (touched.password || submitted) && !validatePassword(password);
  const emailError = emailInvalid ? 'Enter a valid school email address.' : '';
  const passwordError = passwordInvalid ? 'Password must be at least 6 characters.' : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setError('');

    if (!validateEmail(email) || !validatePassword(password)) return;

    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setPassword('');
      return;
    }

    navigate(from, { replace: true });
  };

  return (
    <div className="login-shell">
      <img className="login-shell__banner" src={lnhsBanner} alt="" aria-hidden="true" />
      <div className="login-shell__overlay" aria-hidden="true" />
      <div className="login-system-badge">
        <div className="login-system-badge__name">LNHS ATTENDSYNC</div>
        <div className="login-system-badge__desc">with SMS Notification Using QR Code</div>
      </div>

      <main className="login-content">
        <section className="login-left" aria-label="Looc National High School">
          <div className="login-left__seal-row">
            <img className="login-left__seal" src={lnhsLogo} alt="Looc National High School seal" />
            <span className="login-left__accent" aria-hidden="true" />
            <div className="login-left__wordmark">
              <h1>
                <span>LOOC NATIONAL</span>
                <span>HIGH SCHOOL</span>
              </h1>
              <p className="login-left__motto">The School of Achievers</p>
            </div>
          </div>

          <div className="login-left__divider" aria-hidden="true" />

          <div className="login-left__description">
            <span className="login-left__system-icon" aria-hidden="true">
              <QrCode size={24} />
            </span>
            <div>
              <h2>Attendance Monitoring System</h2>
              <p>
                A modern and secure system for real-time attendance tracking with SMS
                notifications using QR Code technology.
              </p>
            </div>
          </div>

          <div className="login-left__features" aria-label="System features">
            <div className="login-left__feature">
              <span><QrCode size={22} /></span>
              <p>QR Code<br />Scanning</p>
            </div>
            <div className="login-left__feature">
              <span><MessageSquare size={22} /></span>
              <p>Auto SMS<br />Notifications</p>
            </div>
            <div className="login-left__feature">
              <span><ShieldCheck size={22} /></span>
              <p>Secure &amp;<br />Reliable</p>
            </div>
            <div className="login-left__feature">
              <span><BarChart3 size={22} /></span>
              <p>Real-time<br />Reports</p>
            </div>
          </div>

          <footer className="login-left__footer">
            <p>Looc National High School</p>
            <span>The School of Achievers</span>
          </footer>
        </section>

        <section className="login-card login-card--reference" aria-label="LNHS AttendSync sign in">
          <div className="login-card__title">
            <h2><LogIn size={18} aria-hidden="true" /> Sign in</h2>
            <p>to your LNHS AttendSync account</p>
          </div>
          <div className="login-card__divider" aria-hidden="true" />

          {error && (
            <Alert type="error" onClose={() => setError('')} className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="login-form login-card__form">
            <FormField label="SCHOOL EMAIL ADDRESS" required id="email" error={emailError}>
              <div className="login-field">
                <Mail className="login-field__icon" size={16} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  className={`field-input ${emailError ? 'error' : ''}`}
                  placeholder="you@lnhs.edu.ph"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!emailError}
                  disabled={loading}
                />
              </div>
            </FormField>

            <FormField label="PASSWORD" required id="password" error={passwordError}>
              <div className="login-form__pw login-field">
                <Lock className="login-field__icon" size={16} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`field-input ${passwordError ? 'error' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  autoComplete="current-password"
                  aria-invalid={!!passwordError}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-form__reveal"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="login-form__submit"
            >
              <LogIn size={16} aria-hidden="true" />
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="login-form__help">
              For account concerns, contact the school administrator.
            </p>
          </form>

          <div className="login-card__authorized">
            <span>Authorized Users Only</span>
          </div>
          <p className="login-card__footer">
            Looc National High School | Attendance Monitoring System
          </p>
        </section>
      </main>

      <div className="login-footer">v2.0 · © {new Date().getFullYear()} LNHS</div>
    </div>
  );
}
