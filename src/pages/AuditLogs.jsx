import { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import Alert from '../components/Alert';
import { EmptyTableRow } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const ACTION_LABELS = {
  'attendance.recorded': 'Attendance recorded',
  'attendance.rescanned': 'Attendance rescanned',
  'qr.generated': 'QR credential issued',
  'qr.revoked': 'QR credential revoked',
  'sms.retry': 'SMS retried',
  'attendance.absences_finalized': 'Daily absences finalized',
  'settings.attendance_cutoff_updated': 'Attendance cutoff updated',
};

function readDetails(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { message: String(parsed) };
  } catch {
    return { message: value };
  }
}

function formatTarget(log) {
  const targetType = String(log.targetType || '').trim();
  const targetId = String(log.targetId || '').trim();
  const details = readDetails(log.details);

  switch (targetType) {
    case 'qr_code':
      return 'QR credential';
    case 'attendance': {
      const studentId = String(details.studentId || '').trim();
      const suffix = studentId.slice(-6);
      return suffix ? `Attendance record · …${suffix}` : 'Attendance record';
    }
    case 'settings':
      return `${targetId || 'System'} settings`;
    case 'student':
      return 'Student';
    case 'teacher':
      return 'Teacher';
    case 'section':
      return 'Section';
    case 'parentcontacts':
    case 'parent_contact':
      return 'Parent contact';
    default:
      return targetType || '—';
  }
}

function readableDetails(log, students, sections) {
  const details = readDetails(log.details);
  const student = students.find((item) => item.id === details.studentId);
  const studentName = student?.name || student?.studentCode || student?.code || details.studentCode || details.studentId;
  const section = sections.find((item) => item.id === details.sectionId || item.name === details.sectionId);
  const sectionName = section?.name || details.sectionId;
  const status = details.status ? String(details.status).toUpperCase() : '';

  if (log.action === 'attendance.recorded' || log.action === 'attendance.rescanned') {
    const subject = studentName ? `${studentName}${status ? ` marked ${status}` : ''}` : (status ? `Status: ${status}` : 'Attendance updated');
    return [subject, sectionName ? `Section ${sectionName}` : '', details.smsStatus ? `SMS ${details.smsStatus}` : ''].filter(Boolean).join(' · ');
  }
  if (log.action === 'qr.generated') {
    return [`QR issued${studentName ? ` for ${studentName}` : ''}`, sectionName ? `Section ${sectionName}` : ''].filter(Boolean).join(' · ');
  }
  if (log.action === 'qr.revoked') return `QR credential ${log.targetId || ''} revoked`.trim();
  if (log.action === 'sms.retry') return `SMS retry completed with status ${details.status || 'unknown'}`;
  if (log.action === 'settings.attendance_cutoff_updated') return `Attendance cutoff changed to ${details.cutoff || 'a new value'}`;
  if (log.action === 'attendance.absences_finalized') {
    const created = Number(details.created || 0);
    const skipped = Number(details.skipped || 0);
    return `${created} absence record${created === 1 ? '' : 's'} created; ${skipped} existing record${skipped === 1 ? '' : 's'} skipped`;
  }

  const entries = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 4)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}: ${value}`);
  return entries.join(' · ') || 'No additional details';
}

function actorLabel(log, user, teachers) {
  if (!log.actorUid || log.actorUid === 'system') return 'System';
  if (user?.uid === log.actorUid) return user.displayName || user.email || 'Current user';
  const teacher = teachers.find((item) => item.uid === log.actorUid);
  if (teacher?.name) return teacher.name;
  return `User …${String(log.actorUid).slice(-6)}`;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  });
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const { auditLogs: logs, students, sections, teachers } = useData();
  const { user } = useAuth();

  const rows = useMemo(() => logs.map((log) => ({
    ...log,
    actor: actorLabel(log, user, teachers),
    summary: readableDetails(log, students, sections),
    targetLabel: formatTarget(log),
    actionLabel: ACTION_LABELS[log.action] || String(log.action || 'Other action').replaceAll('.', ' '),
  })), [logs, user, teachers, students, sections]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((log) => [
      log.action,
      log.actionLabel,
      log.actor,
      log.actorUid,
      log.targetLabel,
      log.targetType,
      log.targetId,
      log.summary,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [rows, search]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-sub">Append-only log of sensitive administrative actions.</p>
        </div>
      </div>

      <Alert type="info" className="mb-4">
        <ShieldCheck size={14} style={{ flexShrink: 0 }} />
        Audit records are written by trusted backend code, are append-only, and cannot be modified or deleted through the UI.
      </Alert>

      <div className="relative mb-4" style={{ maxWidth: '380px' }}>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="field-input pl-9"
          placeholder="Search action, actor, or record…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table audit-table">
            <thead>
              <tr>
                <th>Log ID</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td className="audit-id">{log.id || '—'}</td>
                  <td className="audit-actor" title={log.actorUid || ''}>{log.actor}</td>
                  <td><span className="audit-action">{log.actionLabel}</span></td>
                  <td className="audit-target" title={log.targetId || ''}>{log.targetLabel}</td>
                  <td className="audit-details">{log.summary}</td>
                  <td className="audit-time">{formatTimestamp(log.createdAt)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <EmptyTableRow
                  colSpan={6}
                  icon={ShieldCheck}
                  title={logs.length ? 'No audit entries match your search.' : 'No audit entries yet.'}
                  subtitle={logs.length ? 'Try another action, actor, or record.' : 'Sensitive administrative actions will be logged here.'}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
