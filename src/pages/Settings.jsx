import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, KeyRound, MessageSquare, Moon, Save, Sun } from 'lucide-react';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageCover from '../components/PageCover';
import { useAuth } from '../context/AuthContext';
import { staffApiGet, useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_SMS_TEMPLATES = {
  present: 'Your child {student_name} was marked Present for {period} on {date}.',
  late: 'Your child {student_name} was marked Late for {period} on {date}.',
  absent: 'Your child {student_name} was marked Absent for {period} on {date}.'
};
const DEFAULT_SMS_RUNTIME = { mode: 'inherit', disabled: false, dailyCapPerStudent: 4 };

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'sms', label: 'SMS' },
  { id: 'security', label: 'Security' },
];

export default function Settings() {
  const [tab, setTab] = useState('general');
  const [settingsNow, setSettingsNow] = useState(() => new Date());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [cutoff, setCutoff] = useState('07:30');
  const [qrValidity, setQrValidity] = useState('365');
  const [allowRescan, setAllowRescan] = useState(true);
  const [smsSender, setSmsSender] = useState('LNHS');
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [gatewayProvider, setGatewayProvider] = useState('semaphore');
  const [gatewayCredential, setGatewayCredential] = useState('SEMAPHORE_API_KEY');
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [gatewayLoadFailed, setGatewayLoadFailed] = useState(false);
  const [notifyPresent, setNotifyPresent] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [simulateSms, setSimulateSms] = useState(false);
  const [presentTemplate, setPresentTemplate] = useState(DEFAULT_SMS_TEMPLATES.present);
  const [lateTemplate, setLateTemplate] = useState(DEFAULT_SMS_TEMPLATES.late);
  const [absentTemplate, setAbsentTemplate] = useState(DEFAULT_SMS_TEMPLATES.absent);
  const [templatesLoadFailed, setTemplatesLoadFailed] = useState(false);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesFeedback, setTemplatesFeedback] = useState(null);
  const [smsTestStudentId, setSmsTestStudentId] = useState('');
  const [smsTestConfirmed, setSmsTestConfirmed] = useState(false);
  const [smsTestSending, setSmsTestSending] = useState(false);
  const [smsTestFeedback, setSmsTestFeedback] = useState(null);
  const [runtimeMode, setRuntimeMode] = useState(DEFAULT_SMS_RUNTIME.mode);
  const [runtimeDisabled, setRuntimeDisabled] = useState(DEFAULT_SMS_RUNTIME.disabled);
  const [runtimeDailyCap, setRuntimeDailyCap] = useState(DEFAULT_SMS_RUNTIME.dailyCapPerStudent);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [runtimeLoadFailed, setRuntimeLoadFailed] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [runtimeFeedback, setRuntimeFeedback] = useState(null);
  const [savedRuntimeMode, setSavedRuntimeMode] = useState(DEFAULT_SMS_RUNTIME.mode);
  const [savedRuntimeDisabled, setSavedRuntimeDisabled] = useState(DEFAULT_SMS_RUNTIME.disabled);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState('');
  const [loginRateLimit, setLoginRateLimit] = useState('5');
  const [qrRateLimit, setQrRateLimit] = useState('60');
  const [auditExports, setAuditExports] = useState(true);
  const [schoolName, setSchoolName] = useState('Looc National High School');
  const [schoolDivision, setSchoolDivision] = useState('Division of Romblon');
  const [schoolRegion, setSchoolRegion] = useState('Region IV-B MIMAROPA');
  const [schoolContact, setSchoolContact] = useState('+63917XXXXXXX');

  const { students, saveAttendanceSettings, saveSmsTemplates, saveSmsRuntime, sendAutomaticSmsTest } = useData();
  const { changePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const runtimeSectionRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setSettingsNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const settingsDate = settingsNow.toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  });
  const settingsTime = settingsNow.toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
  });

  useEffect(() => {
    if (!saved) return undefined;
    const timeout = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  useEffect(() => {
    let active = true;
    staffApiGet('/admin/settings/sms-templates')
      .then(({ templates = {} }) => {
        if (!active) return;
        setPresentTemplate(typeof templates.present === 'string' ? templates.present : DEFAULT_SMS_TEMPLATES.present);
        setLateTemplate(typeof templates.late === 'string' ? templates.late : DEFAULT_SMS_TEMPLATES.late);
        setAbsentTemplate(typeof templates.absent === 'string' ? templates.absent : DEFAULT_SMS_TEMPLATES.absent);
      })
      .catch(() => {
        if (active) setTemplatesLoadFailed(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    staffApiGet('/admin/settings/sms-gateway')
      .then(({ configured = false, provider = 'semaphore', credential = 'SEMAPHORE_API_KEY' }) => {
        if (!active) return;
        setGatewayConfigured(configured);
        setGatewayProvider(provider);
        setGatewayCredential(credential);
      })
      .catch(() => {
        if (active) setGatewayLoadFailed(true);
      })
      .finally(() => {
        if (active) setGatewayLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    staffApiGet('/admin/settings/sms-runtime')
      .then(({ runtime = {} }) => {
        if (!active) return;
        const mode = ['inherit', 'simulated', 'live'].includes(runtime.mode) ? runtime.mode : DEFAULT_SMS_RUNTIME.mode;
        const disabled = runtime.disabled === true;
        const dailyCapPerStudent = Number.isInteger(runtime.dailyCapPerStudent) && runtime.dailyCapPerStudent >= 0
          ? runtime.dailyCapPerStudent
          : DEFAULT_SMS_RUNTIME.dailyCapPerStudent;
        setRuntimeMode(mode);
        setRuntimeDisabled(disabled);
        setRuntimeDailyCap(dailyCapPerStudent);
        setSavedRuntimeMode(mode);
        setSavedRuntimeDisabled(disabled);
      })
      .catch(() => {
        if (active) setRuntimeLoadFailed(true);
      })
      .finally(() => {
        if (active) setRuntimeLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleSaveSmsTemplates = async () => {
    setTemplatesSaving(true);
    setTemplatesFeedback(null);
    try {
      await saveSmsTemplates({ present: presentTemplate, late: lateTemplate, absent: absentTemplate });
      setTemplatesFeedback({ type: 'success', text: 'SMS templates saved.' });
    } catch (error) {
      setTemplatesFeedback({ type: 'error', text: error?.message || 'Unable to save SMS templates.' });
    } finally {
      setTemplatesSaving(false);
    }
  };

  const handleTestAutomaticSms = async () => {
    if (!smsTestStudentId || !smsTestConfirmed || smsTestSending) return;
    setSmsTestSending(true);
    setSmsTestFeedback(null);
    try {
      const result = await sendAutomaticSmsTest(smsTestStudentId);
      if (result.status === 'sent') {
        setSmsTestFeedback({ type: 'success', text: 'IPROG accepted the test message. Phone delivery is not confirmed.' });
      } else if (result.status === 'simulated') {
        setSmsTestFeedback({ type: 'warn', text: 'SMS was simulated; no real message was sent.' });
      } else {
        setSmsTestFeedback({ type: 'error', text: result.reason || `Test SMS was not sent (${result.status || 'unknown status'}).` });
      }
    } catch (error) {
      setSmsTestFeedback({ type: 'error', text: error?.message || 'Unable to send test SMS.' });
    } finally {
      setSmsTestSending(false);
      setSmsTestConfirmed(false);
    }
  };

  const closeLiveConfirm = useCallback(() => {
    setShowLiveConfirm(false);
    setLiveConfirmText('');
  }, []);

  const doSaveRuntime = async () => {
    const dailyCapPerStudent = Number(runtimeDailyCap);
    if (!Number.isInteger(dailyCapPerStudent) || dailyCapPerStudent < 0 || dailyCapPerStudent > 20) {
      setRuntimeFeedback({ type: 'error', text: 'Daily cap must be a whole number from 0 to 20.' });
      return false;
    }

    setRuntimeSaving(true);
    setRuntimeFeedback(null);
    try {
      await saveSmsRuntime({ mode: runtimeMode, disabled: runtimeDisabled, dailyCapPerStudent });
      setSavedRuntimeMode(runtimeMode);
      setSavedRuntimeDisabled(runtimeDisabled);
      setRuntimeDailyCap(dailyCapPerStudent);
      setRuntimeFeedback({ type: 'success', text: 'Runtime SMS settings saved.' });
      return true;
    } catch (error) {
      setRuntimeFeedback({ type: 'error', text: error?.message || 'Unable to save runtime SMS settings.' });
      return false;
    } finally {
      setRuntimeSaving(false);
    }
  };

  const handleSaveRuntime = async () => {
    setRuntimeFeedback(null);
    if (runtimeMode === 'live' && !runtimeDisabled && (savedRuntimeMode !== 'live' || savedRuntimeDisabled)) {
      setLiveConfirmText('');
      setShowLiveConfirm(true);
      return;
    }
    await doSaveRuntime();
  };

  const handleConfirmLive = async () => {
    if (liveConfirmText !== 'CONFIRM' || runtimeSaving) return;
    await doSaveRuntime();
    closeLiveConfirm();
  };

  const openRuntimeControl = (event) => {
    event.preventDefault();
    setTab('sms');
    window.setTimeout(() => runtimeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const runtimePreview = runtimeDisabled
    ? 'Next SMS will be: BLOCKED (disabled)'
    : runtimeMode === 'inherit'
      ? 'Next SMS will be: inherit server default'
      : runtimeMode === 'simulated'
        ? 'Next SMS will be: SIMULATED'
        : 'Next SMS will be: LIVE (real SMS)';

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
    <div className="settings-page animate-fade-in">
      {savedRuntimeMode === 'live' && !savedRuntimeDisabled && !runtimeLoading && (
        <div className="settings-live-banner" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>LIVE SMS MODE ACTIVE — Real messages are being sent to parents.</span>
          <a href="#sms-runtime-control" onClick={openRuntimeControl}>Go to Runtime Control</a>
        </div>
      )}
      <PageCover
        eyebrow="Administrator Panel"
        title="Settings"
        subtitle="School configuration and system parameters."
        actions={(
          <div className="settings-cover__datetime" aria-label="Current date and time in Asia/Manila">
            <span>{settingsDate}</span>
            <span>{settingsTime}</span>
          </div>
        )}
      />
      {saved && <Alert type="success" className="mb-4">Attendance settings saved successfully.</Alert>}
      {saveError && <Alert type={tab === 'attendance' ? 'error' : 'warn'} className="mb-4">{saveError}</Alert>}

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections" role="tablist">
          {TABS.map(({ id, label }) => {
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
                {gatewayLoadFailed && <Alert type="error">SMS provider settings could not be loaded.</Alert>}
                <fieldset className="settings-runtime__mode" disabled={gatewayLoading}>
                  <legend className="field-label">Active SMS provider</legend>
                  <div className="checkbox-row">
                    <span>{gatewayProvider === 'iprog' ? 'IPROG SMS' : 'Semaphore'}</span>
                    <span className="settings-section__hint">{gatewayLoading ? 'Checking configuration…' : gatewayConfigured ? 'Configured on server' : `${gatewayCredential} is missing`}</span>
                  </div>
                </fieldset>
                {gatewayProvider === 'semaphore' && (
                  <FormField label="Sender Name / Short Code" id="sms-sender">
                    <input id="sms-sender" className="field-input" value={smsSender} onChange={(event) => setSmsSender(event.target.value)} />
                  </FormField>
                )}
                {gatewayProvider === 'iprog' && <p className="settings-section__hint">Configure the approved sender name in your IPROG account.</p>}
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

                <div id="sms-runtime-control" ref={runtimeSectionRef}>
                  <h2 className="settings-section__title settings-section__title--spaced">Runtime SMS Control</h2>
                  <p className="settings-section__hint">These settings override the server's default SMS mode. Changes take effect immediately — no server restart required.</p>
                  {runtimeLoadFailed && <Alert type="warn">Using safe defaults — runtime settings could not be loaded.</Alert>}
                  {runtimeFeedback && <Alert type={runtimeFeedback.type}>{runtimeFeedback.text}</Alert>}

                  <fieldset className="settings-runtime__mode" disabled={runtimeLoading || runtimeSaving}>
                    <legend className="field-label">SMS mode</legend>
                    <label className="checkbox-row">
                      <input type="radio" name="sms-runtime-mode" value="inherit" checked={runtimeMode === 'inherit'} onChange={() => { setRuntimeMode('inherit'); setRuntimeFeedback(null); }} />
                      <span>Use server default (inherit)</span>
                    </label>
                    <label className="checkbox-row">
                      <input type="radio" name="sms-runtime-mode" value="simulated" checked={runtimeMode === 'simulated'} onChange={() => { setRuntimeMode('simulated'); setRuntimeFeedback(null); }} />
                      <span>Force Simulated (no real SMS)</span>
                    </label>
                    <label className="checkbox-row">
                      <input type="radio" name="sms-runtime-mode" value="live" checked={runtimeMode === 'live'} onChange={() => { setRuntimeMode('live'); setRuntimeFeedback(null); }} />
                      <span>Force Live (real SMS will be sent)</span>
                    </label>
                  </fieldset>

                  <label className="checkbox-row">
                    <input type="checkbox" checked={runtimeDisabled} disabled={runtimeLoading || runtimeSaving} onChange={(event) => { setRuntimeDisabled(event.target.checked); setRuntimeFeedback(null); }} />
                    <span>Stop all SMS immediately</span>
                  </label>

                  <FormField label="Max SMS per student per day" id="sms-runtime-daily-cap" hint="0 means no limit. Applies only to Live mode.">
                    <input
                      id="sms-runtime-daily-cap"
                      type="number"
                      className="field-input mono settings-number-input"
                      min={0}
                      max={20}
                      step={1}
                      value={runtimeDailyCap}
                      disabled={runtimeLoading || runtimeSaving}
                      onChange={(event) => { setRuntimeDailyCap(event.target.value); setRuntimeFeedback(null); }}
                    />
                  </FormField>

                  <p className="settings-section__hint" role="status">{runtimePreview}</p>
                  <Button variant="primary" onClick={handleSaveRuntime} loading={runtimeSaving} disabled={runtimeLoading}>
                    Save Runtime Settings
                  </Button>
                </div>

                <h2 className="settings-section__title settings-section__title--spaced">Test Automatic SMS</h2>
                <p className="settings-section__hint">Sends the Present template with a [TEST] prefix through the same guardian lookup, runtime guard, and provider function used after a scan. It does not create an attendance record and counts toward the daily cap.</p>
                <FormField label="Test student" id="sms-test-student">
                  <select id="sms-test-student" className="field-input" value={smsTestStudentId} onChange={(event) => { setSmsTestStudentId(event.target.value); setSmsTestConfirmed(false); setSmsTestFeedback(null); }}>
                    <option value="">Select a student</option>
                    {[...students].filter((student) => student.active !== false).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map((student) => (
                      <option key={student.id} value={student.id}>{student.name || 'Unnamed student'} · {student.studentCode || student.code || student.id}</option>
                    ))}
                  </select>
                </FormField>
                <label className="checkbox-row">
                  <input type="checkbox" checked={smsTestConfirmed} disabled={!smsTestStudentId || smsTestSending} onChange={(event) => setSmsTestConfirmed(event.target.checked)} />
                  <span>I understand this may send a real, billable SMS to the selected student's linked guardian.</span>
                </label>
                {smsTestFeedback && <Alert type={smsTestFeedback.type}>{smsTestFeedback.text}</Alert>}
                <Button variant="outline" onClick={handleTestAutomaticSms} loading={smsTestSending} disabled={!smsTestStudentId || !smsTestConfirmed || smsTestSending || !gatewayConfigured || runtimeLoading || runtimeDisabled}>
                  <MessageSquare size={14} /> Send one test SMS
                </Button>

                <h2 className="settings-section__title settings-section__title--spaced">Message Templates</h2>
                <p className="settings-section__hint">Placeholders: {'{student_name}'}, {'{section}'}, {'{period}'}, {'{date}'}, {'{status}'}. These are filled in when the message is sent.</p>
                {templatesLoadFailed && <Alert type="warn">Using default templates — could not load saved ones.</Alert>}
                {templatesFeedback && <Alert type={templatesFeedback.type}>{templatesFeedback.text}</Alert>}

                <div>
                  <label className="field-label" htmlFor="sms-template-present">Present message</label>
                  <textarea
                    id="sms-template-present"
                    className="field-input"
                    rows={3}
                    maxLength={320}
                    value={presentTemplate}
                    onChange={(event) => { setPresentTemplate(event.target.value); setTemplatesFeedback(null); }}
                  />
                  <p className="field-hint text-right">{presentTemplate.length} / 320</p>
                </div>
                <div>
                  <label className="field-label" htmlFor="sms-template-late">Late message</label>
                  <textarea
                    id="sms-template-late"
                    className="field-input"
                    rows={3}
                    maxLength={320}
                    value={lateTemplate}
                    onChange={(event) => { setLateTemplate(event.target.value); setTemplatesFeedback(null); }}
                  />
                  <p className="field-hint text-right">{lateTemplate.length} / 320</p>
                </div>
                <div>
                  <label className="field-label" htmlFor="sms-template-absent">Absent message</label>
                  <textarea
                    id="sms-template-absent"
                    className="field-input"
                    rows={3}
                    maxLength={320}
                    value={absentTemplate}
                    onChange={(event) => { setAbsentTemplate(event.target.value); setTemplatesFeedback(null); }}
                  />
                  <p className="field-hint text-right">{absentTemplate.length} / 320</p>
                </div>
                <Button variant="primary" onClick={handleSaveSmsTemplates} loading={templatesSaving}>
                  {templatesSaving ? 'Saving...' : 'Save Templates'}
                </Button>
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

      {showLiveConfirm && (
        <Modal
          title="Enable Live SMS Mode?"
          onClose={closeLiveConfirm}
          maxWidth="520px"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeLiveConfirm} disabled={runtimeSaving}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmLive} loading={runtimeSaving} disabled={liveConfirmText !== 'CONFIRM'}>
                Enable Live Mode
              </Button>
            </div>
          )}
        >
          <div className="grid gap-3">
            <Alert type="warn">
              <span className="flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" /> Real SMS messages will be sent to real parents. Each message costs money. Only proceed if your SMS gateway is configured and approved.</span>
            </Alert>
            <FormField label="Type CONFIRM to enable live mode" id="sms-live-confirm">
              <input id="sms-live-confirm" className="field-input" value={liveConfirmText} onChange={(event) => setLiveConfirmText(event.target.value)} autoComplete="off" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
