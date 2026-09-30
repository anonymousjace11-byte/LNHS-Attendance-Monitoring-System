import { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, CheckCircle, Clock, AlertTriangle, Wifi, WifiOff, ShieldCheck, Shield, UserRound, Trash2, Info } from 'lucide-react';
import { staffApiGet, useData } from '../context/DataContext';
import Button from '../components/Button';
import Alert from '../components/Alert';

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  });
}

function playTone(frequency, durationMs) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationMs / 1000);
    window.setTimeout(() => context.close(), durationMs + 100);
  } catch {
    return;
  }
}

function getSmsLabel(status) {
  return ({ sent: 'Sent', simulated: 'Simulated', skipped: 'No contact', failed: 'Failed', pending: 'Pending' })[status] || 'Not sent';
}

function getStatusLabel(status) {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
    return 'Not recorded';
}

const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];
const PERIOD_WINDOWS = {
  'AM-1': '7:00 – 7:30 AM',
  'AM-2': '11:00 – 11:30 AM',
  'PM-1': '1:00 – 1:30 PM',
  'PM-2': '4:00 – 4:30 PM',
};
const PERIOD_RANGES = [
  { period: 'AM-1', start: '07:00', end: '07:30' },
  { period: 'AM-2', start: '11:00', end: '11:30' },
  { period: 'PM-1', start: '13:00', end: '13:30' },
  { period: 'PM-2', start: '16:00', end: '16:30' },
];

function getCurrentPeriod() {
  const clock = new Date().toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila',
  });
  return PERIOD_RANGES.find(({ start, end }) => clock >= start && clock <= end)?.period || 'AM-1';
}

export default function Scanner() {
  const [input, setInput] = useState('');
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [scanState, setScanState] = useState('ready');
  const [excusedStudentId, setExcusedStudentId] = useState('');
  const [excuseReason, setExcuseReason] = useState('');
  const [excuseMessage, setExcuseMessage] = useState('');
  const [excuseSaving, setExcuseSaving] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState(null);
  const [preview, setPreview] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [time, setTime] = useState(formatTime());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sessionCount, setSessionCount] = useState({ present: 0, late: 0, errors: 0 });
  const [soundOn, setSoundOn] = useState(true);
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);
  const { students, attendance, recordAttendance, recordExcusedAttendance } = useData();

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    staffApiGet('/staff/system-status')
      .then((status) => { if (active) setGatewayConfigured(Boolean(status.smsGatewayConfigured)); })
      .catch(() => { if (active) setGatewayConfigured(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(bufferTimerRef.current), []);

  useEffect(() => {
    setScanState((current) => online ? (current === 'disconnected' ? 'ready' : current) : 'disconnected');
  }, [online]);

  useEffect(() => {
    inputRef.current?.focus();
    const refocus = setInterval(() => inputRef.current?.focus(), 3000);
    return () => clearInterval(refocus);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    const timer = setTimeout(() => {
      setPreview(null);
      setScanState('ready');
    }, 2500);
    return () => clearTimeout(timer);
  }, [preview]);

  const pushRecent = useCallback((entry) => {
    setRecentScans((current) => [entry, ...current].slice(0, 5));
  }, []);

  const recordSessionResult = useCallback((status) => {
    setSessionCount((current) => ({
      ...current,
      [status === 'present' || status === 'late' ? status : 'errors']:
        current[status === 'present' || status === 'late' ? status : 'errors'] + 1
    }));
  }, []);

  const processQR = useCallback((raw, scanPeriod) => {
    const payload = raw.trim();
    if (!payload) return;
    setScanState('reading');

    const scannedAt = formatTime();
    const student = students.find((item) => [item.qrValue, item.qrUuid, item.studentCode, item.code, item.id].filter(Boolean).includes(payload));
    if (!student) {
      setScanState('not-found');
      const entry = { id: `${Date.now()}-${Math.random()}`, status: 'error', time: scannedAt, message: 'QR credential was not found in the live student records.' };
      setPreview({ ...entry, student: null, record: null });
      pushRecent(entry);
      recordSessionResult('error');
      if (soundOn) playTone(220, 200);
      return;
    }

    setScanState('processing');
    recordAttendance(student, scanPeriod).then((record) => {
      setScanState('success');
      const status = record.status || 'present';
      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        status,
        time: scannedAt,
        student,
        record,
        message: `${scanPeriod} attendance recorded as ${status}.`
      };
      setPreview(entry);
      pushRecent(entry);
      recordSessionResult(status);
      if (soundOn) playTone(status === 'late' ? 660 : 880, 130);
    }).catch((error) => {
      const state = error.message?.includes('already has an') ? 'duplicate'
        : error.message?.includes('assigned section') ? 'denied'
          : error.name === 'TypeError' ? 'disconnected'
            : 'not-found';
      setScanState(state);
      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        status: 'error',
        time: scannedAt,
        student,
        record: null,
        message: error.message || 'Attendance could not be recorded.'
      };
      setPreview(entry);
      pushRecent(entry);
      recordSessionResult('error');
      if (soundOn) playTone(220, 250);
    });
  }, [pushRecent, recordAttendance, recordSessionResult, soundOn, students]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    processQR(bufferRef.current || input, period);
    bufferRef.current = '';
    window.clearTimeout(bufferTimerRef.current);
    setInput('');
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    bufferRef.current = value;
    setInput(value);
    window.clearTimeout(bufferTimerRef.current);
    if (value) {
      bufferTimerRef.current = window.setTimeout(() => {
        bufferRef.current = '';
        setInput('');
      }, 100);
    }
  };

  const handleExcusedSubmit = async (event) => {
    event.preventDefault();
    setExcuseMessage('');
    if (!excusedStudentId) {
      setExcuseMessage('Select a student before marking the period excused.');
      return;
    }
    setExcuseSaving(true);
    try {
      await recordExcusedAttendance(excusedStudentId, period, excuseReason);
      const student = students.find((item) => item.id === excusedStudentId);
      setExcuseMessage(`${student?.name || 'Student'} marked excused for ${period}.`);
      setExcusedStudentId('');
      setExcuseReason('');
    } catch (error) {
      setExcuseMessage(error.message || 'Unable to mark this period excused.');
    } finally {
      setExcuseSaving(false);
    }
  };

  const manilaTime = new Date().toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila',
  });
  const activePeriod = PERIOD_RANGES.find(({ start, end }) => manilaTime >= start && manilaTime <= end)?.period;
  const getPeriodState = (item) => {
    const scansRecorded = attendance
      .filter((record) => record.date === todayKey)
      .filter((record) => record.scans ? Boolean(record.scans[item]) : item === 'AM-1' && Boolean(record.status)).length;
    const range = PERIOD_RANGES.find((entry) => entry.period === item);
    if (students.length > 0 && scansRecorded >= students.length) return 'Completed';
    if (activePeriod === item) return 'Active';
    if (range && manilaTime > range.end) return 'Completed';
    return 'Pending';
  };
  const isLate = period === 'AM-1' && manilaTime > '07:30';
  const previewIsError = preview?.status === 'error';
  const statusLabel = preview?.status === 'present' && preview?.record?.period === 'AM-1'
    ? 'On-Time'
    : getStatusLabel(preview?.status);
  const studentCode = preview?.student?.studentCode || preview?.student?.code || preview?.student?.id || '';
  const sectionName = preview?.student?.section || preview?.record?.sectionId || preview?.student?.sectionId || '';
  const smsStatus = preview?.record?.smsStatus;
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const todayScanCount = attendance
    .filter((record) => record.date === todayKey)
    .reduce((count, record) => count + (record.scans
      ? PERIODS.filter((item) => record.scans[item]).length
      : Number(Boolean(record.status))), 0);

  return (
    <div className="scanner-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">QR Scanner</h1>
          <p className="page-sub">Scan student QR credentials via USB scanner or keyboard input.</p>
        </div>
        <div className="page-header__actions scanner-header-actions">
          <div className={`status-pill ${online ? 'status-pill--ok' : 'status-pill--err'}`}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? 'Backend Connected' : 'Offline'}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSoundOn((current) => !current)} aria-pressed={soundOn}>
            Sound {soundOn ? 'On' : 'Off'}
          </Button>
        </div>
      </header>

      {!online && (
        <Alert type="error" className="mb-4">
          Scanner is offline. Attendance cannot be recorded until the connection is restored.
        </Alert>
      )}

      <section className={`card scanner-gateway ${gatewayConfigured ? 'is-configured' : ''}`} aria-live="polite">
        <div className="scanner-gateway__icon"><AlertTriangle size={17} /></div>
        <div>
          <strong>{gatewayConfigured === null ? 'SMS Gateway Status Unavailable' : gatewayConfigured ? 'SMS Gateway Configured' : 'SMS Gateway Not Configured'}</strong>
          <p>{gatewayConfigured === null
            ? 'The server configuration could not be checked.'
            : gatewayConfigured
              ? 'A messaging provider is configured. Delivery status is recorded per scan.'
              : 'No live messaging provider credentials are configured. Attendance scans will still be recorded.'}</p>
        </div>
      </section>

      <section
        className={`card scanner-result ${preview ? `has-result is-${previewIsError ? 'error' : preview.status}` : 'is-idle'} state-${scanState}`}
        aria-live="polite"
        aria-label="Latest scan result"
        data-scan-state={scanState}
      >
        {preview ? (
          <>
            <div className="scanner-result__photo">
              {preview.student?.photoUrl
                ? <img src={preview.student.photoUrl} alt={preview.student.name || 'Student'} />
                : <div className="scanner-result__placeholder"><UserRound size={36} aria-hidden="true" /></div>}
            </div>
            <div className="scanner-result__details">
              <div className={`scanner-result__status ${previewIsError ? 'status-error' : `status-${preview.status}`}`}>
                {previewIsError ? <AlertTriangle size={18} /> : preview.status === 'late' ? <Clock size={18} /> : <CheckCircle size={18} />}
                <strong>{previewIsError ? 'Scan rejected' : statusLabel}</strong>
                <time>{preview.time}</time>
              </div>
              <h2>{preview.student?.name || 'Unknown credential'}</h2>
              {studentCode && <p className="scanner-result__id">{studentCode}</p>}
              {sectionName && <p className="scanner-result__section">{sectionName}</p>}
              <p className="scanner-result__message">{preview.message}</p>
              {!previewIsError && (
                <p className={`scanner-result__sms sms-${smsStatus || 'unknown'}`}>
                  SMS: <strong>{getSmsLabel(smsStatus)}</strong>
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="scanner-result__empty">
            <QrCode size={28} aria-hidden="true" />
            <div>
              <strong>Ready for next scan</strong>
              <span>Student details and attendance result will appear here.</span>
            </div>
          </div>
        )}
      </section>

      <div className="scanner-grid">
        <div className="scanner-side">
          <section className="card scanner-clock">
            <div className="scanner-clock__face">
              <div className="scanner-clock__time">{time}</div>
              <div className="scanner-clock__date">
                {new Date().toLocaleDateString('en-PH', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  timeZone: 'Asia/Manila',
                })}
              </div>
              <div className={`scanner-clock__cutoff ${isLate ? 'is-late' : 'is-present'}`}>
                <ShieldCheck size={12} />
                {period === 'AM-1' ? (isLate ? 'AFTER CUTOFF - LATE' : 'BEFORE CUTOFF - ON-TIME') : `${period} SCAN PERIOD`}
              </div>
            </div>
            <div className="scanner-clock__foot">
              Cutoff: <strong>07:30</strong> - Server time is authoritative
            </div>
          </section>

          <section className="card scanner-device">
            <div className="card-header"><span className="card-title">Device Status</span></div>
            <div className="scanner-device__row"><span>Network</span><strong><span className={`device-dot ${online ? 'is-on' : 'is-off'}`} />{online ? 'Online' : 'Offline'}</strong></div>
            <div className="scanner-device__row"><span>Input mode</span><strong>Keyboard-wedge (HID)</strong></div>
            <p className="scanner-device__note"><Info size={13} /> A browser may report “Yuren HID FS Keyboard”; that does not verify the reader brand. The TEKLEAD reader operates as a keyboard-wedge device.</p>
          </section>

          <section className="card scanner-input-card" aria-label="QR scanner input">
            <div className="card-header">
              <span className="card-title">{online ? 'QR Input - Ready' : 'Scanner Offline'}</span>
              <ShieldCheck size={14} aria-hidden="true" />
            </div>
            <div className="card-body">
              <label className="field-label" htmlFor="scan-period">Attendance period</label>
              <select id="scan-period" className="field-input mb-3" value={period} onChange={(event) => setPeriod(event.target.value)}>
                {PERIODS.map((item) => <option key={item} value={item}>{item} · {PERIOD_WINDOWS[item]}</option>)}
              </select>
              <input
                ref={inputRef}
                className="scanner-input field-input"
                placeholder={online ? 'Waiting for QR scan...' : 'Offline - scanner disabled'}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={!online}
                autoFocus
                aria-label="QR scan input"
              />
              <p className="field-hint">USB scanner auto-submits on Enter. All input is validated server-side.</p>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><span className="card-title">Today’s Scans</span><span className="scanner-log__count">{todayScanCount} recorded</span></div>
            <div className="scanner-period-list">
              {PERIODS.map((item) => (
                <div className="scanner-period-row" key={item}>
                  <span>{item}</span><span>{PERIOD_WINDOWS[item]}</span><span className={`badge badge-${getPeriodState(item).toLowerCase()}`}>{getPeriodState(item)}</span>
                </div>
              ))}
            </div>
            <div className="scanner-rules">
              <p><strong>Four scans per day maximum</strong> — one in each period.</p>
              <p><strong>AM-1 cutoff: 7:30 AM</strong> — before is On-Time; after is Late.</p>
              <p><strong>Duplicate scans</strong> in the same period are rejected.</p>
              <p><strong>Assigned section only</strong> — enforced by the API.</p>
            </div>
            <div className="card-header scanner-session-header"><span className="card-title">This-session results</span></div>
            <div className="scanner-summary">
              <div className="scanner-summary__cell scanner-summary__cell--ok">
                <div className="scanner-summary__value">{sessionCount.present}</div>
                <div className="scanner-summary__label">Present</div>
              </div>
              <div className="scanner-summary__cell scanner-summary__cell--warn">
                <div className="scanner-summary__value">{sessionCount.late}</div>
                <div className="scanner-summary__label">Late</div>
              </div>
              <div className="scanner-summary__cell scanner-summary__cell--err">
                <div className="scanner-summary__value">{sessionCount.errors}</div>
                <div className="scanner-summary__label">Errors</div>
              </div>
            </div>
          </section>
        </div>

        <section className="card scanner-log" aria-label="Five most recent scans">
          <div className="card-header">
            <span className="card-title">Scan Log</span>
            <div className="scanner-log__actions">
              <span className="scanner-log__count">{recentScans.length} of 5</span>
              {recentScans.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setRecentScans([]);
                  setSessionCount({ present: 0, late: 0, errors: 0 });
                }} aria-label="Clear scan log">
                  <Trash2 size={12} /> Clear
                </Button>
              )}
            </div>
          </div>
          <div className="scanner-log__body">
            {recentScans.length ? recentScans.map((entry) => {
              const isError = entry.status === 'error';
              const isScanLate = entry.status === 'late';
              const Icon = isError ? AlertTriangle : isScanLate ? Clock : CheckCircle;
              return (
                <div className={`scanner-log__row is-${isError ? 'error' : entry.status}`} key={entry.id}>
                  <div className="scanner-log__icon"><Icon size={17} aria-hidden="true" /></div>
                  <div className="scanner-log__content">
                    <div className="scanner-log__head">
                      <span className="scanner-log__name">{entry.student?.name || (isError ? 'Rejected scan' : 'Unknown')}</span>
                      <time className="scanner-log__time">{entry.time}</time>
                    </div>
                    {entry.student && (
                      <div className="scanner-log__sub">
                        {entry.student.studentCode || entry.student.code || entry.student.id}
                        {entry.student.section && ` · ${entry.student.section}`}
                        {entry.record?.period && ` · ${entry.record.period}`}
                      </div>
                    )}
                    <div className="scanner-log__message">{entry.message}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="scanner-log__empty">
                <div className="scanner-log__empty-icon"><QrCode size={27} aria-hidden="true" /></div>
                <p className="scanner-log__empty-title">No scans yet</p>
                <p className="scanner-log__empty-sub">Scan a student QR credential to begin</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card scanner-manual-card">
        <div className="card-header"><span className="card-title">Manual Excused Entry</span><span className="scanner-log__count">Selected period: {period}</span></div>
        <form className="scanner-manual-form" onSubmit={handleExcusedSubmit}>
          <label className="field-label" htmlFor="excused-student">Student</label>
          <select id="excused-student" className="field-input" value={excusedStudentId} onChange={(event) => setExcusedStudentId(event.target.value)}>
            <option value="">Select a student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name || student.studentCode || student.id} · {student.section || student.sectionId || 'Unassigned'}</option>)}
          </select>
          <label className="field-label" htmlFor="excuse-reason">Reason <span className="text-muted">(optional)</span></label>
          <input id="excuse-reason" className="field-input" value={excuseReason} onChange={(event) => setExcuseReason(event.target.value)} maxLength={240} />
          <Button type="submit" variant="secondary" loading={excuseSaving} disabled={excuseSaving}>Mark Excused</Button>
        </form>
        {excuseMessage && <p className="scanner-manual-message" role="status">{excuseMessage}</p>}
      </section>
    </div>
  );
}
