import { useState, useMemo } from 'react';
import { Search, Download, MessageSquare } from 'lucide-react';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { EmptyTableRow } from '../components/EmptyState';
import { useData } from '../context/DataContext';
import { displayValue } from '../utils/display';

const STATUS_OPTS = ['All','sent','failed','simulated','skipped'];

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  return `${'*'.repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`;
}

export default function SmsLogs() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const { smsLogs: logs, students } = useData();
  const getStudent = (log) => students.find((student) => student.id === log.studentId);

  const filtered = useMemo(() => logs.filter((l) => {
    const q = search.toLowerCase();
    const student = getStudent(l);
    const studentName = student?.name || l.studentId || 'Unknown student';
    const studentCode = student?.studentCode || student?.code || l.studentId || '';
    return (!q || studentName.toLowerCase().includes(q) || studentCode.toLowerCase().includes(q) || String(l.phone || '').includes(q))
        && (status === 'All' || l.status === status);
  }), [logs, students, search, status]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">SMS Logs</h1>
          <p className="page-sub">Parent notification history. Phone numbers masked in display.</p>
        </div>
        <Button variant="ghost" size="sm">
          <Download size={13} /> Export (Admin)
        </Button>
      </div>

      <Alert type="warn" className="mb-4">
        <strong>Privacy:</strong> Phone numbers are masked. Simulated delivery is never shown as real. Export is admin-only and audit-logged.
      </Alert>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1" style={{ minWidth:'220px', maxWidth:'340px' }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)', pointerEvents:'none' }} />
          <input className="field-input pl-9" placeholder="Search by student or phone…" value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTS.map(s=>(
            <Button key={s} variant={status===s?'primary':'ghost'} size="sm"
              solid={status===s}
              onClick={()=>setStatus(s)}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full sms-logs-table">
            <thead>
              <tr>
                <th>Log ID</th><th>Student</th><th>Period</th><th>Recipient (masked)</th>
                <th>Message Preview</th><th>Status</th><th>Provider</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const student = getStudent(l);
                const message = displayValue(l.message);
                const status = displayValue(l.status);
                return <tr key={l.id}>
                  <td><span style={{ fontFamily:'JetBrains Mono', fontSize:'.75rem', color:'var(--text-muted)' }}>{displayValue(l.id)}</span></td>
                  <td>
                    <div style={{ fontWeight:600, fontSize:'.875rem' }}>{displayValue(student?.name)}</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'.7rem', color:'var(--text-muted)' }}>{displayValue(student?.studentCode || student?.code || l.studentId)}</div>
                  </td>
                  <td>{displayValue(l.period)}</td>
                  <td><span style={{ fontFamily:'JetBrains Mono', fontSize:'.82rem', color:'var(--text-sub)' }}>{maskPhone(l.phone)}</span></td>
                  <td style={{ maxWidth:'220px' }}>
                    <span style={{ fontSize:'.82rem', color:'var(--text-sub)' }} title={l.message || ''}>
                      {message.length > 60 ? `${message.slice(0, 60)}…` : message}
                    </span>
                  </td>
                  <td>
                    {status === '—'
                      ? <span className="text-muted">—</span>
                      : <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>}
                  </td>
                  <td style={{ fontSize:'.82rem', color:'var(--text-sub)' }}>{displayValue(l.provider)}</td>
                  <td><span style={{ fontFamily:'JetBrains Mono', fontSize:'.75rem', color:'var(--text-muted)' }}>{displayValue(l.createdAt)}</span></td>
                </tr>
              })}
              {!filtered.length && (
                <EmptyTableRow
                  colSpan={8}
                  icon={MessageSquare}
                  title={logs.length ? 'No SMS logs match your filters.' : 'No SMS logs yet.'}
                  subtitle={logs.length ? 'Try a different search or status.' : 'Scans and manual sends will appear here.'}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
