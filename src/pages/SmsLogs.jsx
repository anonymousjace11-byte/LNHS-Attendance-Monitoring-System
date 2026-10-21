import { Fragment, useEffect, useState, useMemo } from 'react';
import { Search, Download, MessageSquare, RotateCw } from 'lucide-react';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { EmptyTableRow } from '../components/EmptyState';
import Pagination from '../components/Pagination';
import PageCover from '../components/PageCover';
import SortableHeader, { sortRows } from '../components/SortableHeader';
import { useData } from '../context/DataContext';
import { displayValue } from '../utils/display';

const STATUS_OPTS = ['All','sent','failed','simulated','skipped'];
const PAGE_SIZE = 10;

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  return `${'*'.repeat(Math.max(4, digits.length - 2))}${digits.slice(-2)}`;
}

function maskPhoneForCsv(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `+63 ****** ${digits.slice(-4)}` : '';
}

function csvCell(value, protectFormula = true) {
  let text = String(value ?? '');
  if (protectFormula && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDateTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('en-PH', {
    dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Manila',
  });
}

function downloadCsv(rows, getStudent) {
  const columns = ['Date/Time', 'Student', 'Period', 'Recipient (masked)', 'Message', 'Status', 'Provider', 'Manual'];
  const csvRows = rows.map((log) => {
    const student = getStudent(log);
    return [
      formatDateTime(log.createdAt),
      student?.name || log.studentId || 'Unknown student',
      log.period || '',
      maskPhoneForCsv(log.phone),
      log.message || '',
      log.status || '',
      log.provider || '',
      log.manual === true ? 'Yes' : 'No',
    ];
  });
  const csv = [columns, ...csvRows].map((row) => row.map((value, index) => csvCell(value, index !== 3)).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  anchor.href = url;
  anchor.download = `sms-logs-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SmsLogs() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingId, setRetryingId] = useState('');
  const [retryErrors, setRetryErrors] = useState({});
  const { smsLogs: logs, students, retrySmsLog } = useData();
  const getStudent = (log) => students.find((student) => student.id === log.studentId);

  const latestLogs = useMemo(() => {
    const supersededIds = new Set(logs.map((log) => log.retryOf).filter(Boolean));
    return logs.filter((log) => !supersededIds.has(log.id));
  }, [logs]);

  const filtered = useMemo(() => latestLogs.filter((l) => {
    const q = search.toLowerCase();
    const student = getStudent(l);
    const studentName = student?.name || l.studentId || 'Unknown student';
    const studentCode = student?.studentCode || student?.code || l.studentId || '';
    return (!q || studentName.toLowerCase().includes(q) || studentCode.toLowerCase().includes(q) || String(l.phone || '').includes(q))
        && (status === 'All' || l.status === status);
  }), [latestLogs, students, search, status]);

  useEffect(() => setCurrentPage(1), [search, status]);
  const sortedLogs = sortRows(filtered, sortColumn, sortDirection, (log, column) => {
    if (column === 'createdAt') return new Date(log.createdAt || 0).getTime();
    if (column === 'student') return getStudent(log)?.name || log.studentId || '';
    return log[column] || '';
  });
  const pageLogs = sortedLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changeSort = (column) => {
    if (sortColumn === column) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleRetry = async (log) => {
    setRetryingId(log.id);
    setRetryErrors((current) => ({ ...current, [log.id]: '' }));
    try {
      await retrySmsLog(log.id);
    } catch (error) {
      setRetryErrors((current) => ({ ...current, [log.id]: error.message || 'Unable to retry SMS.' }));
    } finally {
      setRetryingId('');
    }
  };

  const handleExport = () => downloadCsv(filtered, getStudent);

  return (
    <div className="animate-fade-in">
      <PageCover
        eyebrow="Administrator Panel"
        title="SMS Logs"
        subtitle="Parent notification history. Phone numbers masked in display."
        actions={<Button variant="ghost" size="sm" onClick={handleExport}><Download size={13} /> Export CSV</Button>}
      />

      <Alert type="warn" className="mb-4">
        <strong>Privacy:</strong> Phone numbers are masked in the table and export. Simulated delivery is never shown as real.
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
                <th>Log ID</th>
                <SortableHeader label="Student" column="student" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <SortableHeader label="Period" column="period" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <th>Recipient (masked)</th><th>Message Preview</th>
                <SortableHeader label="Status" column="status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <th>Provider</th>
                <SortableHeader label="Date/Time" column="createdAt" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageLogs.map((l) => {
                const student = getStudent(l);
                const message = displayValue(l.message);
                const status = displayValue(l.status);
                return <Fragment key={l.id}>
                  <tr>
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
                    <td>
                      {l.status === 'failed' && (
                        <Button variant="outline" className="table-action--retry" size="sm" loading={retryingId === l.id} onClick={() => handleRetry(l)}>
                          <RotateCw size={12} /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                  {retryErrors[l.id] && (
                    <tr key={`${l.id}-retry-error`}>
                      <td colSpan={9}><Alert type="error">{retryErrors[l.id]}</Alert></td>
                    </tr>
                  )}
                </Fragment>
              })}
              {!filtered.length && (
                <EmptyTableRow
                  colSpan={9}
                  icon={MessageSquare}
                  title={logs.length ? 'No SMS logs match your filters.' : 'No SMS logs yet.'}
                  subtitle={logs.length ? 'Try a different search or status.' : 'Scans and manual sends will appear here.'}
                />
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={sortedLogs.length} currentPage={currentPage} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="SMS logs" />
      </div>
    </div>
  );
}
