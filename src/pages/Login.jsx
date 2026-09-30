import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Alert from '../components/Alert';
import FormField from '../components/FormField';
import lnhsLogo from '../imports/LNHS LOGO.png';

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
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__gov">
          <div className="login-card__gov-line">Republic of the Philippines</div>
          <div className="login-card__gov-line">Department of Education</div>
          <div className="login-card__gov-line login-card__gov-line--sm">
            Region IV-B MIMAROPA · Division of Romblon
          </div>
        </div>

        <div className="login-card__school">
          <div className="login-card__seal">
            <img src={lnhsLogo} alt="Looc National High School seal" />
          </div>
          <h1 className="login-card__school-name">Looc National High School</h1>
          <p className="login-card__school-sub">
            Mataas na Paaralang Nasyonal ng Looc · Est. 1948
          </p>
          <p className="login-card__school-id">School ID: 301765</p>
          <p className="login-card__system">Attendance Monitoring System</p>
        </div>

        <div className="login-card__form-wrap">
          <div className="login-card__form-header">
            <LogIn size={15} />
            <span>Sign in to your account</span>
          </div>

          {error && (
            <Alert type="error" onClose={() => setError('')} className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="login-form">
            <FormField label="School Email Address" required id="email" error={emailError}>
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
            </FormField>

            <FormField label="Password" required id="password" error={passwordError}>
              <div className="login-form__pw">
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
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="login-form__help">
              For account concerns, contact the school administrator.
            </p>
          </form>
        </div>

        <div className="login-card__footer">
          <span>v2.0</span>
          <span>Copyright {new Date().getFullYear()} LNHS</span>
        </div>
      </div>

      <p className="login-page__foot">For official use of LNHS faculty and staff only.</p>
    </div>
  );
}
