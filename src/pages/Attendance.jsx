import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import Button from '../components/Button';
import { useData } from '../context/DataContext';

const STATUS_OPTS = ['All Status','Present','Late','Absent','Excused'];
const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];

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
  const { students, attendance, sections } = useData();
  const records = attendance.map((record) => {
    const student = students.find((item) => item.id === record.studentId);
    return { ...record, studentId: student?.studentCode || student?.code || record.studentId, name: student?.name || record.studentId, section: student?.section || record.sectionId || 'Unassigned', sms: record.smsStatus || 'skipped' };
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

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-sub">Daily attendance register · four scan periods · server time is authoritative.</p>
        </div>
        <Button variant="ghost" size="sm">
          <Download size={13} /> Export CSV
        </Button>
      </div>

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
                <th>Date</th><th>Student</th><th>Section</th>
                {PERIODS.map((item)=><th key={item}>{item}</th>)}<th>SMS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date"><span className="mono">{r.date}</span></td>
                  <td data-label="Student">
                    <div style={{ fontWeight:600, fontSize:'.875rem' }}>{r.name}</div>
                    <div style={{ fontFamily:'JetBrains Mono', fontSize:'.7rem', color:'var(--text-muted)' }}>{r.studentId}</div>
                  </td>
                  <td data-label="Section" style={{ fontSize:'.85rem', color:'var(--text-sub)' }}>{r.section}</td>
                  {PERIODS.map((item) => {
                    const scan = getPeriodScan(r, item);
                    return <td data-label={item} key={item}>{scan ? <div className="period-cell"><span className="period-cell__time">{scan.time}</span><span className={`badge badge-${scan.status}`}>{scan.status === 'present' ? (item === 'AM-1' ? 'ON-TIME' : 'PRESENT') : String(scan.status).toUpperCase()}</span></div> : <span className="period-cell__empty">—</span>}</td>;
                  })}
                  <td data-label="SMS"><span className={`badge badge-${r.sms}`}>{r.sms.toUpperCase()}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="8" className="empty-row">No records match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor:'var(--border)', background:'#f8fafc' }}>
          <span style={{ fontSize:'.8rem', color:'var(--text-muted)' }}>
            {filtered.length} record{filtered.length!==1?'s':''} shown
          </span>
        </div>
      </div>
    </div>
  );
}
