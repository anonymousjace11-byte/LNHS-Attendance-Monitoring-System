import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import Button from '../components/Button';
import Pagination from '../components/Pagination';
import PageCover from '../components/PageCover';
import SortableHeader, { sortRows } from '../components/SortableHeader';
import { useData } from '../context/DataContext';

const STATUS_OPTS = ['All Status','Present','Late','Absent','Excused'];
const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];
const PAGE_SIZE = 10;

function getAttendanceDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value === 'object') {
    const seconds = Number(value._seconds ?? value.seconds);
    const rawNanoseconds = Number(value._nanoseconds ?? value.nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      date = new Date(seconds * 1000 + (Number.isFinite(rawNanoseconds) ? rawNanoseconds : 0) / 1e6);
    }
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function formatAttendanceTime(value) {
  if (typeof value === 'string') return value;
  if (!value) return '—';

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'object') {
    const seconds = Number(value._seconds ?? value.seconds);
    const rawNanoseconds = Number(value._nanoseconds ?? value.nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      date = new Date(seconds * 1000 + (Number.isFinite(rawNanoseconds) ? rawNanoseconds : 0) / 1e6);
    }
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function getPeriodScan(record, period) {
  if (record.scans) return record.scans[period] || null;
  if (record.scans?.[period]) return record.scans[period];
  if (period === 'AM-1' && record.status) {
    return { time: record.time || null, status: record.status, smsStatus: record.smsStatus };
  }
  return null;
}

function getArrivalStatus(record) {
  if ('arrivalStatus' in record) return record.arrivalStatus;
  if (record.scans) return record.scans['AM-1']?.status || '';
  return record.status;
}

export default function Attendance() {
  const [searchParams] = useSearchParams();
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [section, setSection]   = useState(() => searchParams.get('section') || 'All Sections');
  const [status, setStatus]     = useState('All Status');
  const [period, setPeriod] = useState('All Periods');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const { students, attendance, sections } = useData();
  const records = attendance.map((record) => {
    const student = students.find((item) => item.id === record.studentId);
    return { ...record, date: getAttendanceDateKey(record.date), studentId: student?.studentCode || student?.code || record.studentId, name: student?.name || record.studentId, section: student?.section || record.sectionId || 'Unassigned', sms: record.smsStatus || 'skipped' };
  });
  const sectionOptions = ['All Sections', ...sections.map((item) => item.name)];
  const filtered = useMemo(() => records.filter((r) => {
    const q = search.toLowerCase();
    const periodScan = period === 'All Periods' ? null : getPeriodScan(r, period);
    const effectiveStatus = period === 'All Periods'
      ? getArrivalStatus(r)
      : periodScan?.status;
    return (!q || r.name.toLowerCase().includes(q) || r.studentId.includes(q))
      && (section === 'All Sections' || r.section === section)
      && (status === 'All Status' || effectiveStatus === status.toLowerCase())
      && (period === 'All Periods' || !!periodScan)
        && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo);
  }), [records, search, section, status, period, dateFrom, dateTo]);
  useEffect(() => setCurrentPage(1), [search, section, status, period, dateFrom, dateTo]);
  const sortedRecords = sortRows(filtered, sortColumn, sortDirection, (record, column) => {
    if (column === 'date') return record.date || '';
    if (column === 'student') return record.name || '';
    return record.section || '';
  });
  const pageRecords = sortedRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changeSort = (column) => {
    if (sortColumn === column) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="animate-fade-in">
      <PageCover
        eyebrow="Administrator Panel"
        title="Attendance Records"
        subtitle="Daily attendance register · four scan periods · server time is authoritative."
        actions={<Button variant="ghost" size="sm"><Download size={13} /> Export CSV</Button>}
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1" style={{ minWidth:'220px' }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)', pointerEvents:'none' }} />
          <input className="field-input pl-9" placeholder="Search by name or student ID…" value={search} onChange={(e)=>setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0" style={{ whiteSpace:'nowrap' }}>From</label>
          <input type="date" className="field-input" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} style={{ width:'auto' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0" style={{ whiteSpace:'nowrap' }}>To</label>
          <input type="date" className="field-input" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} style={{ width:'auto' }} />
        </div>
        <div className="relative">
          <select className="field-input" value={section} onChange={(e)=>setSection(e.target.value)}>
            {sectionOptions.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="relative">
          <select className="field-input" value={period} onChange={(e)=>setPeriod(e.target.value)}>
            {['All Periods', ...PERIODS].map((item)=><option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="relative">
          <select className="field-input" value={status} onChange={(e)=>setStatus(e.target.value)}>
            {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full period-register">
            <thead>
              <tr>
                <SortableHeader label="Date" column="date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <SortableHeader label="Student" column="student" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                <SortableHeader label="Section" column="section" sortColumn={sortColumn} sortDirection={sortDirection} onSort={changeSort} />
                {PERIODS.map((item)=><th key={item}>{item}</th>)}<th>SMS</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date"><span className="mono">{r.date}</span></td>
                  <td data-label="Student">
                    <div style={{ fontWeight:600, fontSize:'.875rem' }}>{r.name}</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'.7rem', color:'var(--text-muted)' }}>{r.studentId}</div>
                  </td>
                  <td data-label="Section" style={{ fontSize:'.85rem', color:'var(--text-sub)' }}>{r.section}</td>
                  {PERIODS.map((item) => {
                    const scan = getPeriodScan(r, item);
                    return <td data-label={item} key={item}>{scan ? <div className="period-cell"><span className="period-cell__time">{formatAttendanceTime(scan.time)}</span><span className={`badge badge-${scan.status}`}>{scan.status === 'present' ? (item === 'AM-1' ? 'ON-TIME' : 'PRESENT') : String(scan.status).toUpperCase()}</span></div> : <span className="period-cell__empty">—</span>}</td>;
                  })}
                  <td data-label="SMS"><span className={`badge badge-${r.sms}`}>{r.sms.toUpperCase()}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="8" className="empty-row">No records match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={sortedRecords.length} currentPage={currentPage} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} itemLabel="attendance records" />
      </div>
    </div>
  );
}
