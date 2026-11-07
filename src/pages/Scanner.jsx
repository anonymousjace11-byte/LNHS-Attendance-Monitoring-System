import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { QrCode, CheckCircle, Clock, AlertTriangle, ShieldCheck, UserRound, Trash2, Info, MessageSquare, Usb, Keyboard, List, CalendarDays } from 'lucide-react';
import { staffApiGet, useData } from '../context/DataContext';
import { auth } from '../firebase';
import { OFFLINE_ATTENDANCE_SYNCED_EVENT } from '../utils/offlineAttendance';
import Button from '../components/Button';
import Alert from '../components/Alert';
import Modal from '../components/Modal';

const resolveApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname);

    if (isLocalHost) return 'http://127.0.0.1:5000';
  }

  return (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
};
const API_URL = resolveApiBaseUrl();

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
}

function formatShortDate(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
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
const SCAN_IDLE_TIMEOUT_MS = 250;
const SCANNER_INPUT_FEEDBACK_MS = 2000;
const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
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

function getCurrentPeriod(date = new Date()) {
  const clock = date.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila',
  });
  for (let index = PERIOD_RANGES.length - 1; index >= 0; index -= 1) {
    if (clock >= PERIOD_RANGES[index].start) return PERIOD_RANGES[index].period;
  }
  return 'AM-1';
}

function getManilaDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date
    ? value
    : typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return MANILA_DATE_FORMATTER.format(date);
}

export default function Scanner() {
  const [input, setInput] = useState('');
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [automaticPeriod, setAutomaticPeriod] = useState(true);
  const [scanState, setScanState] = useState('ready');
  const [excusedStudentId, setExcusedStudentId] = useState('');
  const [excuseReason, setExcuseReason] = useState('');
  const [excuseMessage, setExcuseMessage] = useState('');
  const [excuseSaving, setExcuseSaving] = useState(false);
  const [gatewayConfigured, setGatewayConfigured] = useState(null);
  const [preview, setPreview] = useState(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsTemplates, setSmsTemplates] = useState(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [recentScans, setRecentScans] = useState([]);
  const [time, setTime] = useState(formatTime());
  const [networkOnline, setNetworkOnline] = useState(() => navigator.onLine);
  const [scannerInputActive, setScannerInputActive] = useState(false);
  const [sessionCount, setSessionCount] = useState({ present: 0, late: 0, errors: 0 });
  const [soundOn, setSoundOn] = useState(true);
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const inputRef = useRef(null);
  const manualInputRef = useRef(null);
  const activePreviewIdRef = useRef(null);
  const inputActivityTimerRef = useRef(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef(null);
  const duplicateWarningsRef = useRef(new Set());
  const processingScansRef = useRef(new Set());
  const {
    students,
    attendance,
    parentContacts,
    pendingAttendanceCount,
    offlineSyncError,
    recordAttendance,
    recordExcusedAttendance,
  } = useData();
  const todayKey = MANILA_DATE_FORMATTER.format(new Date());
  const studentByQrValue = useMemo(() => {
    const recordsByQrValue = new Map();
    for (const student of students) {
      for (const value of [student.qrValue, student.qrUuid, student.studentCode, student.code, student.id]) {
        if (value && !recordsByQrValue.has(value)) recordsByQrValue.set(value, student);
      }
    }
    return recordsByQrValue;
  }, [students]);
  const { todayAttendanceKeys, periodScanCounts, todayScanCount } = useMemo(() => {
    const scanKeys = new Set();
    const scanCounts = Object.fromEntries(PERIODS.map((item) => [item, 0]));
    let totalScans = 0;

    for (const record of attendance) {
      if (getManilaDateKey(record.date) !== todayKey) continue;
      if (record.scans) {
        for (const item of PERIODS) {
          if (!record.scans[item]) continue;
          scanKeys.add(`${todayKey}:${record.studentId}:${item}`);
          scanCounts[item] += 1;
          totalScans += 1;
        }
      } else if (record.status) {
        scanKeys.add(`${todayKey}:${record.studentId}:AM-1`);
        scanCounts['AM-1'] += 1;
        totalScans += 1;
      }
    }

    return { todayAttendanceKeys: scanKeys, periodScanCounts: scanCounts, todayScanCount: totalScans };
  }, [attendance, todayKey]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(formatTime(now));
      if (automaticPeriod) setPeriod(getCurrentPeriod(now));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [automaticPeriod]);

  useEffect(() => {
    let active = true;
    staffApiGet('/staff/system-status')
      .then((status) => { if (active) setGatewayConfigured(Boolean(status.smsGatewayConfigured)); })
      .catch(() => { if (active) setGatewayConfigured(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    staffApiGet('/admin/settings/sms-templates')
      .then(({ templates }) => { if (active) setSmsTemplates(templates); })
      .catch(() => { if (active) setSmsTemplates(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => setNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(bufferTimerRef.current);
    window.clearTimeout(inputActivityTimerRef.current);
  }, []);

  useEffect(() => {
    setScanState((current) => networkOnline ? (current === 'disconnected' ? 'ready' : current) : 'disconnected');
  }, [networkOnline]);

  useEffect(() => {
    if (smsModalOpen) return undefined;
    if (manualInputOpen) {
      manualInputRef.current?.focus();
      return undefined;
    }
    inputRef.current?.focus();
    const refocus = setInterval(() => inputRef.current?.focus(), 3000);
    return () => clearInterval(refocus);
  }, [manualInputOpen, smsModalOpen]);

  const recordSessionResult = useCallback((status) => {
    setSessionCount((current) => ({
      ...current,
      [status === 'present' || status === 'late' ? status : 'errors']:
        current[status === 'present' || status === 'late' ? status : 'errors'] + 1
    }));
  }, []);

  useEffect(() => {
    const handleOfflineSync = (event) => {
      const { eventId, record, duplicate } = event.detail || {};
      if (!eventId) return;
      setPreview((current) => {
        if (current?.id !== eventId || current.status !== 'pending-sync') return current;
        if (duplicate) return { ...current, status: 'duplicate', message: 'Attendance was already recorded.' };
        return { ...current, status: record?.status || 'present', record, message: 'Attendance synced successfully.' };
      });
      setRecentScans((current) => current.map((item) => item.id !== eventId
        ? item
        : { ...item, status: duplicate ? 'duplicate' : record?.status || 'present', record }));
      if (record) recordSessionResult(record.status || 'present');
      if (duplicate) setScanState('duplicate');
      else if (record) setScanState('success');
    };
    window.addEventListener(OFFLINE_ATTENDANCE_SYNCED_EVENT, handleOfflineSync);
    return () => window.removeEventListener(OFFLINE_ATTENDANCE_SYNCED_EVENT, handleOfflineSync);
  }, [recordSessionResult]);

  const lastPreviewIdRef = useRef(null);
  useEffect(() => {
    if (!preview?.id) return;
    if (lastPreviewIdRef.current && lastPreviewIdRef.current !== preview.id) {
      setSmsModalOpen(false);
      setSmsTarget(null);
      setSmsMessage('');
      setSmsFeedback(null);
    }
    lastPreviewIdRef.current = preview.id;
  }, [preview?.id]);

  const pushRecent = useCallback((entry) => {
    setRecentScans((current) => [entry, ...current].slice(0, 5));
  }, []);

  const warnDuplicate = useCallback((student, scanPeriod, scannedAt) => {
    const scanKey = `${todayKey}:${student.id}:${scanPeriod}`;
    setScanState('duplicate');
    if (duplicateWarningsRef.current.has(scanKey)) return;

    duplicateWarningsRef.current.add(scanKey);
    const message = `${student.name || 'This student'} already has a ${scanPeriod} scan today. Duplicate scan rejected.`;
    setDuplicateWarning(message);
    pushRecent({
      id: `${Date.now()}-${Math.random()}`,
      status: 'warning',
      time: scannedAt,
      period: scanPeriod,
      student,
      record: null,
      message,
    });
    if (soundOn) playTone(440, 120);
  }, [pushRecent, soundOn, todayKey]);

  const processQR = useCallback(async (raw, scanPeriod) => {
    const payload = raw.trim();
    if (!payload) return;
    const entryId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activePreviewIdRef.current = entryId;
    setScanState('reading');

    const scanInstant = new Date();
    const scannedAt = formatTime(scanInstant);
    const student = studentByQrValue.get(payload);
    if (!student) {
      setScanState('not-found');
      const entry = { id: entryId, status: 'error', time: scannedAt, period: scanPeriod, message: 'QR credential was not found in the live student records.' };
      setPreview({ ...entry, student: null, record: null });
      pushRecent(entry);
      recordSessionResult('error');
      if (soundOn) playTone(220, 200);
      return;
    }

    const scanKey = `${todayKey}:${student.id}:${scanPeriod}`;
    const alreadyScanned = todayAttendanceKeys.has(scanKey);
    if (alreadyScanned || processingScansRef.current.has(scanKey)) {
      warnDuplicate(student, scanPeriod, scannedAt);
      return;
    }

    setDuplicateWarning('');
    processingScansRef.current.add(scanKey);
    setScanState('processing');
    setPreview({ id: entryId, status: 'pending', time: scannedAt, period: scanPeriod, student, record: null });
    try {
      const record = await recordAttendance(student, scanPeriod, {
        eventId: entryId,
        scannedAt: scanInstant.toISOString(),
      });
      if (record.pendingSync) {
        const entry = {
          id: entryId,
          status: 'pending-sync',
          time: scannedAt,
          period: scanPeriod,
          student,
          record: null,
          message: 'Saved on this device. Waiting to sync.',
        };
        if (activePreviewIdRef.current === entryId) {
          setScanState('pending-sync');
          setPreview(entry);
        }
        pushRecent(entry);
        if (soundOn) playTone(660, 130);
        return;
      }
      const status = record.status || 'present';
      const entry = {
        id: entryId,
        status,
        time: scannedAt,
        period: scanPeriod,
        student,
        record,
        message: `${scanPeriod} attendance recorded as ${status}.`
      };
      if (activePreviewIdRef.current === entryId) {
        setScanState('success');
        setPreview(entry);
      }
      pushRecent(entry);
      recordSessionResult(status);
      if (soundOn) playTone(status === 'late' ? 660 : 880, 130);
    } catch (error) {
      if (error.message?.includes('already has an')) {
        warnDuplicate(student, scanPeriod, scannedAt);
        return;
      }

      setDuplicateWarning('');
      const state = error.message?.includes('assigned section') ? 'denied'
          : error.name === 'TypeError' ? 'disconnected'
            : 'not-found';
      const entry = {
        id: entryId,
        status: 'error',
        time: scannedAt,
        period: scanPeriod,
        student,
        record: null,
        message: error.message || 'Attendance could not be recorded.'
      };
      if (activePreviewIdRef.current === entryId) {
        setScanState(state);
        setPreview(entry);
      }
      pushRecent(entry);
      recordSessionResult('error');
      if (soundOn) playTone(220, 250);
    } finally {
      processingScansRef.current.delete(scanKey);
    }
  }, [pushRecent, recordAttendance, recordSessionResult, soundOn, studentByQrValue, todayAttendanceKeys, todayKey, warnDuplicate]);

  const submitScan = () => {
    const payload = bufferRef.current || input;
    if (!payload.trim()) return;
    processQR(bufferRef.current || input, period);
    bufferRef.current = '';
    window.clearTimeout(bufferTimerRef.current);
    if (manualInputOpen) setInput('');
    else if (inputRef.current) inputRef.current.value = '';
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitScan();
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    bufferRef.current = value;
    if (manualInputOpen) setInput(value);
    window.clearTimeout(bufferTimerRef.current);
    if (value.length >= 3 && !manualInputOpen) {
      setScannerInputActive(true);
      window.clearTimeout(inputActivityTimerRef.current);
      inputActivityTimerRef.current = window.setTimeout(() => setScannerInputActive(false), SCANNER_INPUT_FEEDBACK_MS);
    }
    if (value && !manualInputOpen) {
      bufferTimerRef.current = window.setTimeout(() => {
        if (bufferRef.current === value) submitScan();
      }, SCAN_IDLE_TIMEOUT_MS);
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
      setExcuseMessage(`${student?.name || '—'} marked excused for ${period}.`);
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
    const range = PERIOD_RANGES.find((entry) => entry.period === item);
    if (students.length > 0 && periodScanCounts[item] >= students.length) return 'Completed';
    if (activePeriod === item) return 'Active';
    if (range && manilaTime > range.end) return 'Completed';
    return 'Pending';
  };
  const previewIsError = preview?.status === 'error';
  const previewIsPending = preview?.status === 'pending' || preview?.status === 'pending-sync';
  const previewIsSyncPending = preview?.status === 'pending-sync';
  const previewIsDuplicate = preview?.status === 'duplicate';
  const statusLabel = preview?.status === 'present' && preview?.record?.period === 'AM-1'
    ? 'On-Time'
    : getStatusLabel(preview?.status);
  const studentCode = preview?.student?.studentCode || preview?.student?.code || preview?.student?.id || '';
  const sectionName = preview?.student?.section || preview?.record?.sectionId || preview?.student?.sectionId || '';
  const previewPeriod = preview?.period || preview?.record?.period || '';
  const canSendManualSms = Boolean(preview?.student?.id && PERIODS.includes(previewPeriod) && !previewIsError && !previewIsPending && !previewIsDuplicate);
  const smsStatus = preview?.record?.smsStatus;
  const smsParentContact = smsTarget
    ? parentContacts.find((contact) => contact.studentId === smsTarget.student.id)
    : null;
  const smsParentPhone = [smsParentContact?.parentPhone, smsTarget?.student.parentPhone, smsTarget?.student.contactNumber, smsTarget?.student.phone]
    .find((value) => typeof value === 'string' && value.trim()) || '';

  const openManualSmsModal = () => {
    if (!canSendManualSms || !preview?.student) return;
    const studentName = preview.student.name || preview.student.studentCode || preview.student.id;
    const scanStatus = preview.status === 'late' ? 'Late' : 'Present';
    const scanDate = getManilaDateKey(preview.record?.date) || todayKey;
    const section = preview.student.sectionName || preview.student.section || preview.student.sectionId || '';
    const fallbackMessage = `Your child ${studentName} was marked ${scanStatus} for ${previewPeriod} on ${scanDate}.`;
    let message = fallbackMessage;
    try {
      const template = preview.status === 'late' ? smsTemplates?.late : smsTemplates?.present;
      if (typeof template === 'string' && template.trim()) {
        message = template
          .replaceAll('{student_name}', studentName)
          .replaceAll('{section}', section)
          .replaceAll('{period}', previewPeriod)
          .replaceAll('{date}', scanDate)
          .replaceAll('{status}', scanStatus);
      }
    } catch {
      message = fallbackMessage;
    }
    setSmsTarget({ id: preview.id, student: preview.student, period: previewPeriod, status: scanStatus, date: scanDate });
    setSmsMessage(message);
    setSmsFeedback(null);
    setSmsModalOpen(true);
  };

  const closeManualSmsModal = useCallback(() => {
    if (smsSending) return;
    setSmsModalOpen(false);
    setSmsTarget(null);
    setSmsMessage('');
    setSmsFeedback(null);
  }, [smsSending]);

  const handleManualSmsSubmit = async (event) => {
    event.preventDefault();
    if (!smsTarget || !smsMessage.trim() || smsSending) return;
    setSmsSending(true);
    setSmsFeedback(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Firebase authentication required.');
      const response = await fetch(`${API_URL}/sms/send-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: smsTarget.student.id, period: smsTarget.period, message: smsMessage.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to send SMS.');

      if (result.status === 'sent') {
        setSmsMessage('');
        setSmsFeedback({ type: 'success', text: 'SMS sent to parent.' });
      } else if (result.status === 'simulated') {
        setSmsFeedback({ type: 'warn', text: 'Simulated — no live SMS was sent. Configure an SMS gateway in Settings to send real messages.' });
      } else {
        throw new Error(result.error || 'SMS delivery failed.');
      }
    } catch (error) {
      setSmsFeedback({ type: 'error', text: error.message || 'Unable to send SMS.' });
    } finally {
      setSmsSending(false);
    }
  };
  const activeParentContact = preview?.student?.id
    ? parentContacts.find((contact) => contact.studentId === preview.student.id)
    : null;
  const activeParentPhone = [activeParentContact?.parentPhone, preview?.student?.parentPhone, preview?.student?.contactNumber, preview?.student?.phone]
    .find((value) => typeof value === 'string' && value.trim()) || '';
  const scanDate = getManilaDateKey(preview?.record?.date) || todayKey;
  const scanDateDisplay = formatShortDate(scanDate);
  const scanOutcome = preview?.status === 'late' ? 'LATE' : preview?.status === 'present' ? 'PRESENT' : '';
  const scanStatusMessage = preview?.status === 'late'
    ? 'Attendance recorded successfully. Arrival was marked late.'
    : 'Attendance recorded successfully!';

  return (
    <div className="scanner-page animate-fade-in">
      <header className="scanner-page__header">
        <div className="scanner-page__actions">
          {pendingAttendanceCount > 0 && (
            <span className="scanner-pending-sync" role="status" aria-live="polite" title={offlineSyncError || 'Saved on this device; waiting for a connection to sync.'}>
              Pending Sync · {pendingAttendanceCount}
            </span>
          )}
          <span className={`scanner-connection ${!networkOnline ? 'is-disconnected' : scannerInputActive ? 'is-detected' : 'is-waiting'}`}>
            <span className="scanner-connection__dot" />
            {!networkOnline ? 'Network offline' : scannerInputActive ? 'Input detected' : 'Ready for scan'}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSoundOn((current) => !current)} aria-pressed={soundOn}>
            Sound {soundOn ? 'On' : 'Off'}
          </Button>
        </div>
      </header>

      {!networkOnline && (
        <Alert type="error" className="mb-4">
          Network is offline. Attendance cannot be recorded until the connection is restored.
        </Alert>
      )}

      {duplicateWarning && (
        <Alert type="warn" className="scanner-duplicate-warning" onClose={() => setDuplicateWarning('')}>
          {duplicateWarning}
        </Alert>
      )}

      <div className="scanner-layout">
        <div className="scanner-primary">
          <section className={`card scanner-active-card state-${scanState}`} aria-live="polite" aria-label="Active scan result">
            <div className="scanner-active-card__topline">
              <span className={`scanner-result-pill ${previewIsPending ? 'is-pending' : previewIsError ? 'is-error' : preview ? 'is-success' : 'is-ready'}`}>
                {previewIsPending ? <Clock size={15} /> : previewIsError ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
                {previewIsSyncPending ? 'Pending Sync' : preview?.status === 'pending' ? 'Recording…' : previewIsDuplicate ? 'Already Recorded' : previewIsError ? 'Scan Rejected' : preview ? 'Scan Successful' : 'Ready to Scan'}
              </span>
              <span className="scanner-active-card__time"><Clock size={14} />{preview?.time || time}</span>
            </div>

            {preview ? (
              <div className="scanner-active-card__student">
                <div className="scanner-active-card__photo">
                  {preview.student?.photoUrl
                    ? <img src={preview.student.photoUrl} alt={preview.student.name || 'Student'} />
                    : <div className="scanner-result__placeholder"><UserRound size={38} aria-hidden="true" /></div>}
                </div>
                <div className="scanner-active-card__details">
                  <h2>{preview.student ? (preview.student.name || '—') : 'Unknown credential'}</h2>
                  {studentCode && <p className="scanner-active-card__code">Student Code: <strong>{studentCode}</strong></p>}
                  <div className="scanner-active-card__tags">
                    {preview.student?.strand && <span>{preview.student.strand}</span>}
                    {sectionName && <span>{sectionName}</span>}
                    <span>{previewPeriod || period}</span>
                  </div>
                  <div className="scanner-active-card__summary">
                    <div>
                      <span className="scanner-detail-label">Scan Time</span>
                      <strong><Clock size={15} /> {preview.time}</strong>
                    </div>
                    <div>
                      <span className="scanner-detail-label">Attendance</span>
                      <span className={`scanner-attendance-pill ${previewIsPending ? 'is-pending' : preview.status === 'late' ? 'is-late' : previewIsError ? 'is-error' : 'is-present'}`}>
                        {previewIsSyncPending ? 'PENDING SYNC' : previewIsPending ? 'PENDING' : previewIsDuplicate ? 'ALREADY RECORDED' : previewIsError ? 'REJECTED' : scanOutcome || statusLabel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="scanner-active-card__empty">
                <div className="scanner-active-card__empty-icon"><QrCode size={26} /></div>
                <div><strong>Waiting for a student QR code</strong><span>Scan using the connected keyboard-wedge reader.</span></div>
              </div>
            )}

            {preview && (
              <div className={`scanner-attendance-message ${previewIsPending ? 'is-pending' : previewIsError ? 'is-error' : preview.status === 'late' ? 'is-late' : 'is-success'}`} role="status">
                {previewIsPending ? <Clock size={17} /> : previewIsError ? <AlertTriangle size={17} /> : <CheckCircle size={17} />}
                <div>
                  <strong>{previewIsSyncPending ? 'Attendance saved on this device.' : previewIsPending ? 'Student found. Recording attendance…' : previewIsDuplicate ? 'This attendance was already recorded.' : previewIsError ? 'Attendance was not recorded.' : scanStatusMessage}</strong>
                  {previewIsSyncPending && <span>It will sync automatically when the server is available.</span>}
                  {preview?.status === 'pending' && <span>Waiting for attendance confirmation.</span>}
                  {!previewIsError && !previewIsPending && !previewIsDuplicate && <span>SMS notification will be sent to the parent/guardian when available.</span>}
                  {previewIsError && <span>{preview.message}</span>}
                </div>
              </div>
            )}

            <div className="scanner-active-card__contacts">
              <div className="scanner-contact-box">
                <MessageSquare size={18} />
                <div><span>SMS Status</span><strong>{preview ? getSmsLabel(smsStatus) : 'Waiting for scan'}</strong></div>
              </div>
              <div className="scanner-contact-box scanner-contact-box--parent">
                <Info size={18} />
                <div><span>Parent / Guardian</span><strong>{activeParentPhone || 'No contact on file'}</strong></div>
              </div>
              {canSendManualSms && (
                <Button variant="outline" size="sm" onClick={openManualSmsModal}>
                  <MessageSquare size={13} aria-hidden="true" /> Send SMS
                </Button>
              )}
            </div>
          </section>

          <div className="scanner-workbench">
            <section className="card scanner-card scanner-controls-card">
              <div className="scanner-card__header"><h2><Usb size={17} /> Scanner Controls</h2><span className="scanner-log__count">{todayScanCount} scans today</span></div>
              <div className="scanner-controls-card__actions">
                <Button variant="primary" size="lg" disabled={!networkOnline} onClick={() => {
                  setManualInputOpen(false);
                  inputRef.current?.focus();
                  setScannerMessage('Keyboard input is ready. Scan a QR code to test the reader.');
                }}>
                  <Usb size={17} /> Test Scan Input
                </Button>
                <div className="scanner-device-chip">
                  <span className={`device-dot ${!networkOnline ? 'is-off' : scannerInputActive ? 'is-on' : 'is-waiting'}`} />
                  <div><strong>Keyboard-wedge HID</strong><span>{!networkOnline ? 'Network unavailable' : scannerInputActive ? 'Input received' : 'Ready for scan'}</span></div>
                  <Keyboard size={17} />
                </div>
              </div>
              <div className="scanner-period-heading">
                <label className="scanner-period-label" htmlFor="scan-period">Attendance period</label>
                <label className="scanner-period-auto">
                  <input type="checkbox" checked={automaticPeriod} onChange={(event) => setAutomaticPeriod(event.target.checked)} />
                  Auto schedule
                </label>
              </div>
              <select id="scan-period" className="field-input scanner-period-select" value={period} disabled={automaticPeriod} onChange={(event) => setPeriod(event.target.value)}>
                {PERIODS.map((item) => <option key={item} value={item}>{item} · {PERIOD_WINDOWS[item]}</option>)}
              </select>
              <div className="scanner-period-status" aria-label="Period status">
                {PERIODS.map((item) => <span key={item} className={`scanner-period-status__item is-${getPeriodState(item).toLowerCase()}`}><strong>{item}</strong>{getPeriodState(item)}</span>)}
              </div>
              {scannerMessage && <p className="scanner-control-message" role="status">{scannerMessage}</p>}
              <button type="button" className="scanner-manual-toggle" onClick={() => setManualInputOpen((open) => !open)}>
                {manualInputOpen ? 'Hide manual input' : 'Manual Input'}
              </button>
              {manualInputOpen && (
                <div className="scanner-manual-fallback">
                  <label className="field-label" htmlFor="manual-scan-input">QR code value</label>
                  <div className="scanner-manual-fallback__row">
                    <input id="manual-scan-input" ref={manualInputRef} className="field-input" value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Enter or scan a QR value" />
                    <Button variant="secondary" size="sm" onClick={submitScan} disabled={!input.trim()}>Submit</Button>
                  </div>
                </div>
              )}
              <div className="scanner-session-counts">
                This session: <strong>{sessionCount.present} present</strong><span>·</span><strong>{sessionCount.late} late</strong><span>·</span><strong>{sessionCount.errors} errors</strong>
              </div>
            </section>

            <section className="card scanner-card scanner-recent-card">
              <div className="scanner-card__header"><h2><List size={17} /> Recent Scans</h2><span className="scanner-log__count">{recentScans.length} of 5</span></div>
              <div className="scanner-recent-table-wrap">
                <table className="scanner-recent-table">
                  <thead><tr><th>Time</th><th>Student Name</th><th>Code</th><th>Status</th></tr></thead>
                  <tbody>
                    {recentScans.map((entry) => {
                      const status = entry.status === 'warning' || entry.status === 'duplicate' ? 'Duplicate' : entry.status === 'pending-sync' ? 'Pending Sync' : entry.status === 'error' ? 'Rejected' : entry.status === 'late' ? 'Late' : 'Present';
                      return <tr key={entry.id}>
                        <td>{entry.time}</td>
                        <td>{entry.student?.name || (entry.student ? '—' : 'Unknown credential')}</td>
                        <td>{entry.student?.studentCode || entry.student?.code || entry.student?.id || '—'}</td>
                        <td><span className={`scanner-table-status is-${entry.status}`}>{status}</span></td>
                      </tr>;
                    })}
                    {!recentScans.length && <tr><td colSpan="4" className="scanner-recent-table__empty">No scans recorded this session.</td></tr>}
                  </tbody>
                </table>
              </div>
              {recentScans.length > 0 && <Button variant="ghost" size="sm" className="scanner-clear-button" onClick={() => {
                setRecentScans([]);
                setSessionCount({ present: 0, late: 0, errors: 0 });
              }}><Trash2 size={12} /> Clear recent scans</Button>}
            </section>
          </div>
        </div>

        <aside className="scanner-sidebar">
          <section className="card scanner-card scanner-status-card">
            <div className="scanner-card__header"><h2><QrCode size={18} /> Scanner Status</h2><span className={`scanner-status-pill ${!networkOnline ? 'is-disconnected' : scannerInputActive ? 'is-detected' : 'is-waiting'}`}><span className="scanner-connection__dot" />{!networkOnline ? 'Network offline' : scannerInputActive ? 'Input detected' : 'Ready for scan'}</span></div>
            <div className="scanner-status-rows">
              <div><Keyboard size={16} /><span>Device</span><strong>Keyboard-wedge HID</strong></div>
              <div><Usb size={16} /><span>Connection Type</span><strong>USB keyboard input</strong></div>
              <div><QrCode size={16} /><span>Input Method</span><strong>Enter or 250 ms idle</strong></div>
              <div><ShieldCheck size={16} /><span>Permission</span><strong>No browser permission required</strong></div>
            </div>
            <p className={`scanner-gateway-note ${gatewayConfigured ? 'is-configured' : ''}`}>
              {gatewayConfigured === null ? 'SMS gateway status unavailable.' : gatewayConfigured ? 'SMS gateway configured.' : 'SMS gateway not configured; attendance still works.'}
            </p>
          </section>

          <section className="card scanner-card scanner-howto-card">
            <div className="scanner-card__header"><h2><Info size={17} /> How to Use</h2></div>
            <ol className="scanner-howto-list">
              <li><span>1</span><p>Connect a USB QR scanner that types as a keyboard.</p></li>
              <li><span>2</span><p>Choose the active attendance period.</p></li>
              <li><span>3</span><p>Scan the student's QR code.</p></li>
              <li><span>4</span><p>Confirm the result in Active Scan.</p></li>
            </ol>
          </section>

          <section className="card scanner-card scanner-information-card">
            <div className="scanner-card__header"><h2><Clock size={17} /> Scan Information</h2></div>
            <div className="scanner-information-card__grid">
              <div><span>Last Scan</span><strong>{preview?.time || '—'}</strong><small>{scanDateDisplay}</small></div>
              <div><span>Status</span><strong className={networkOnline ? 'is-ready' : 'is-offline'}><span className="scanner-connection__dot" />{networkOnline ? 'Ready for next scan' : 'Network offline'}</strong></div>
            </div>
          </section>
        </aside>
      </div>

      {smsModalOpen && smsTarget && (
        <Modal
          title="Send SMS to Parent"
          onClose={closeManualSmsModal}
          maxWidth="520px"
          footer={(
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeManualSmsModal} disabled={smsSending}>Cancel</Button>
              <Button variant="primary" type="submit" form="manual-sms-form" loading={smsSending} disabled={!smsMessage.trim()}>
                {smsSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          )}
        >
          <form id="manual-sms-form" onSubmit={handleManualSmsSubmit} className="grid gap-3">
            <p className="page-sub">{smsTarget.student.name || '—'} · {smsTarget.student.section || smsTarget.student.sectionId || 'Unassigned section'}</p>
            <div>
              <label className="field-label" htmlFor="manual-sms-parent-phone">Parent contact</label>
              <input id="manual-sms-parent-phone" className="field-input" value={smsParentPhone || 'Will be resolved from parent contacts on file'} readOnly />
            </div>
            <p className="page-sub">Period: <strong>{smsTarget.period}</strong></p>
            {gatewayConfigured === false && (
              <Alert type="warn">No live SMS gateway is configured. The server will report whether this message is sent, simulated, or unavailable.</Alert>
            )}
            <div>
              <label className="field-label" htmlFor="manual-sms-message">Message</label>
              <textarea
                id="manual-sms-message"
                className="field-input"
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                maxLength={320}
                rows={4}
                autoFocus
              />
              <p className="field-hint text-right">{smsMessage.length} / 320</p>
            </div>
            {smsFeedback && <Alert type={smsFeedback.type}>{smsFeedback.text}</Alert>}
          </form>
        </Modal>
      )}

      <section className="card scanner-manual-card">
        <div className="scanner-card__header"><h2><CalendarDays size={17} /> Manual Excused Entry</h2><span className="scanner-log__count">Selected period: {period}</span></div>
        <form className="scanner-manual-form" onSubmit={handleExcusedSubmit}>
          <label className="field-label" htmlFor="excused-student">Student</label>
          <select id="excused-student" className="field-input" value={excusedStudentId} onChange={(event) => setExcusedStudentId(event.target.value)}>
            <option value="">Select a student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.name || '—'} · {student.studentCode || student.code || student.id} · {student.section || student.sectionId || 'Unassigned'}</option>)}
          </select>
          <label className="field-label" htmlFor="excuse-reason">Reason <span className="text-muted">(optional)</span></label>
          <input id="excuse-reason" className="field-input" value={excuseReason} onChange={(event) => setExcuseReason(event.target.value)} maxLength={240} />
          <Button type="submit" variant="secondary" loading={excuseSaving} disabled={excuseSaving}>Mark Excused</Button>
        </form>
        {excuseMessage && <p className="scanner-manual-message" role="status">{excuseMessage}</p>}
      </section>

      <input
        ref={inputRef}
        className="scanner-capture-input"
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={!networkOnline || manualInputOpen || smsModalOpen}
        tabIndex={-1}
        aria-label="QR scanner keyboard input"
      />
    </div>
  );
}
