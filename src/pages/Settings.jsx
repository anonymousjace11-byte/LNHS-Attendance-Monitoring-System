import { useEffect, useState } from 'react';
import { Building2, Clock, KeyRound, MessageSquare, Moon, Save, ShieldCheck, Sun } from 'lucide-react';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

const TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

export default function Settings() {
  const [tab, setTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [cutoff, setCutoff] = useState('07:30');
  const [qrValidity, setQrValidity] = useState('365');
  const [allowRescan, setAllowRescan] = useState(true);
  const [smsSender, setSmsSender] = useState('LNHS');
  const [notifyPresent, setNotifyPresent] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [simulateSms, setSimulateSms] = useState(false);
  const [loginRateLimit, setLoginRateLimit] = useState('5');
  const [qrRateLimit, setQrRateLimit] = useState('60');
  const [auditExports, setAuditExports] = useState(true);
  const [schoolName, setSchoolName] = useState('Looc National High School');
  const [schoolDivision, setSchoolDivision] = useState('Division of Romblon');
  const [schoolRegion, setSchoolRegion] = useState('Region IV-B MIMAROPA');
  const [schoolContact, setSchoolContact] = useState('+63917XXXXXXX');

  const { saveAttendanceSettings } = useData();
  const { changePassword } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!saved) return undefined;
    const timeout = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  const handleSave = async () => {
    setSaveError('');
    setSaved(false);
    try {
      if (tab === 'attendance') {
        await saveAttendanceSettings(cutoff);
        setSaved(true);
      } else {
        setSaveError('These settings are local to this page and are not persisted by the server yet.');
      }
    } catch (error) {
      setSaveError(error?.message || 'Failed to save attendance settings.');
    }
  };

  const handlePasswordChange = async () => {
    const currentPassword = document.getElementById('current-admin-password')?.value || '';
    const newPassword = document.getElementById('new-admin-password')?.value || '';
    const confirmPassword = document.getElementById('confirm-admin-password')?.value || '';
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      document.getElementById('admin-password-form')?.reset();
      setPasswordSuccess('Admin password updated successfully.');
    } catch {
      setPasswordError('The current password is incorrect or the update was rejected.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">School configuration and system parameters.</p>
        </div>
        {saved && <Alert type="success">Attendance settings saved successfully.</Alert>}
        {saveError && <Alert type={tab === 'attendance' ? 'error' : 'warn'}>{saveError}</Alert>}
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`settings-panel-${id}`}
                onClick={() => setTab(id)}
                className={`settings-tab ${active ? 'is-active' : ''}`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-content">
          <section className="card settings-panel" id={`settings-panel-${tab}`} role="tabpanel">
            {tab === 'general' && (
              <div className="settings-section">
                <h2 className="settings-section__title">School Information</h2>
                <FormField label="School Name" id="sch-name">
                  <input id="sch-name" className="field-input" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
                </FormField>
                <div className="settings-form-grid">
                  <FormField label="Division" id="sch-div">
                    <input id="sch-div" className="field-input" value={schoolDivision} onChange={(event) => setSchoolDivision(event.target.value)} />
                  </FormField>
                  <FormField label="Region" id="sch-reg">
                    <input id="sch-reg" className="field-input" value={schoolRegion} onChange={(event) => setSchoolRegion(event.target.value)} />
                  </FormField>
                </div>
                <FormField label="School Contact" id="sch-contact" hint="Philippine mobile number format">
                  <input id="sch-contact" className="field-input mono" value={schoolContact} onChange={(event) => setSchoolContact(event.target.value)} />
                </FormField>

                <h2 className="settings-section__title">Appearance</h2>
                <p className="settings-section__hint">Choose the display theme for the attendance system. This applies to all users.</p>
                <div className="theme-switch" role="group" aria-label="Appearance theme">
                  <button type="button" className={`theme-switch__option ${theme === 'light' ? 'is-active' : ''}`} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
                    <Sun size={15} /><span>Light</span>
                  </button>
                  <button type="button" className={`theme-switch__option ${theme === 'dark' ? 'is-active' : ''}`} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
                    <Moon size={15} /><span>Dark</span>
                  </button>
                </div>
              </div>
            )}

            {tab === 'attendance' && (
              <div className="settings-section">
                <h2 className="settings-section__title">Attendance Rules</h2>
                <FormField label="Daily Cutoff Time - LATE after" id="cutoff" hint="Server time is authoritative. Students scanned at or before this time are Present; after, they are Late.">
                  <input type="time" id="cutoff" className="field-input mono settings-time-input" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
                </FormField>
                <FormField label="QR Credential Validity (days)" id="qr-validity">
                  <input type="number" id="qr-validity" className="field-input mono settings-number-input" value={qrValidity} onChange={(event) => setQrValidity(event.target.value)} />
                </FormField>
                <label className="checkbox-row">
                  <input type="checkbox" checked={allowRescan} onChange={(event) => setAllowRescan(event.target.checked)} />
                  <span>Allow permitted rescan (updates rescan data, retries SMS)</span>
                </label>
              </div>
            )}

            {tab === 'sms' && (
              <div className="settings-section">
                <h2 className="settings-section__title">SMS Provider Configuration</h2>
                <Alert type="warn">SMS credentials are stored in server environment variables only. Never paste API keys here; this form configures non-secret settings only.</Alert>
                <FormField label="Sender Name / Short Code" id="sms-sender">
                  <input id="sms-sender" className="field-input" value={smsSender} onChange={(event) => setSmsSender(event.target.value)} />
                </FormField>
                <div className="settings-checkboxes">
                  <label className="checkbox-row">
                    <input type="checkbox" checked={simulateSms} onChange={(event) => setSimulateSms(event.target.checked)} />
                    <span>Simulate SMS (test mode; no real messages sent)</span>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={notifyPresent} onChange={(event) => setNotifyPresent(event.target.checked)} />
                    <span>Notify parents on Present</span>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={notifyLate} onChange={(event) => setNotifyLate(event.target.checked)} />
                    <span>Notify parents on Late</span>
                  </label>
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div className="settings-section">
                <h2 className="settings-section__title">Rate Limiting</h2>
                <div className="settings-form-grid">
                  <FormField label="Login attempts / 15 min" id="rl-login">
                    <input type="number" id="rl-login" className="field-input mono" value={loginRateLimit} onChange={(event) => setLoginRateLimit(event.target.value)} />
                  </FormField>
                  <FormField label="QR scans / minute" id="rl-qr">
                    <input type="number" id="rl-qr" className="field-input mono" value={qrRateLimit} onChange={(event) => setQrRateLimit(event.target.value)} />
                  </FormField>
                </div>

                <h2 className="settings-section__title settings-section__title--spaced"><KeyRound size={14} /> Admin Password</h2>
                <p className="settings-section__hint">Confirm the current password before creating a new admin password.</p>
                {passwordError && <Alert type="error">{passwordError}</Alert>}
                {passwordSuccess && <Alert type="success">{passwordSuccess}</Alert>}
                <form id="admin-password-form" className="settings-form" onSubmit={(event) => { event.preventDefault(); handlePasswordChange(); }}>
                  <FormField label="Current Password" required id="current-admin-password">
                    <input id="current-admin-password" type="password" className="field-input" autoComplete="current-password" />
                  </FormField>
                  <FormField label="New Password" required id="new-admin-password" hint="At least 6 characters.">
                    <input id="new-admin-password" type="password" className="field-input" autoComplete="new-password" />
                  </FormField>
                  <FormField label="Confirm New Password" required id="confirm-admin-password">
                    <input id="confirm-admin-password" type="password" className="field-input" autoComplete="new-password" />
                  </FormField>
                  <Button variant="primary" type="submit" loading={passwordSaving}>Set Admin Password</Button>
                </form>

                <h2 className="settings-section__title settings-section__title--spaced">Audit</h2>
                <label className="checkbox-row">
                  <input type="checkbox" checked={auditExports} onChange={(event) => setAuditExports(event.target.checked)} />
                  <span>Audit-log all sensitive data exports</span>
                </label>
              </div>
            )}

            <div className="settings-footer">
              <Button variant="primary" onClick={handleSave}><Save size={14} /> Save Settings</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
