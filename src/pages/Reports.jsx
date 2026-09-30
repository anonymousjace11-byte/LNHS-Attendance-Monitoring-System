import { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import Button from '../components/Button';
import Alert from '../components/Alert';
import { useData } from '../context/DataContext';

const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];

function arrivalStatus(record) {
  if ('arrivalStatus' in record) return record.arrivalStatus;
  if (record.scans) return record.scans['AM-1']?.status || '';
  return record.status;
}

function getPeriodScan(record, period) {
  if (record.scans) return record.scans[period] || null;
  if (period === 'AM-1' && record.status) return { time: record.time || '', status: record.status };
  return null;
}

export default function Reports() {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo]     = useState(today);
  const [tab, setTab]           = useState('summary');
  const [generated, setGenerated] = useState(false);
  const [notice, setNotice] = useState('');
  const { students, attendance, sections, smsLogs } = useData();

  const activeStudents = students.filter((student) => student.active !== false);
  const roster = activeStudents.length ? activeStudents : students;
  const filteredAttendance = useMemo(
    () => attendance.filter((record) => record.date >= dateFrom && record.date <= dateTo),
    [attendance, dateFrom, dateTo],
  );
  const totals = {
    enrolled: roster.length,
    present: filteredAttendance.filter((record) => arrivalStatus(record) === 'present').length,
    late: filteredAttendance.filter((record) => arrivalStatus(record) === 'late').length,
  };
  totals.absent = filteredAttendance.filter((record) => arrivalStatus(record) === 'absent').length;
  const overallRate = totals.enrolled
    ? (Math.min(totals.present + totals.late, totals.enrolled) / totals.enrolled * 100).toFixed(1)
    : '0.0';

  const sectionReport = useMemo(() => sections.map((section) => {
    const members = roster.filter((student) => (student.sectionId || student.section) === section.id || (student.sectionId || student.section) === section.name);
    const memberIds = new Set(members.map((student) => student.id));
    const records = filteredAttendance.filter((record) => record.sectionId === section.id || memberIds.has(record.studentId));
    const present = records.filter((record) => arrivalStatus(record) === 'present').length;
    const late = records.filter((record) => arrivalStatus(record) === 'late').length;
    const enrolled = members.length;
    const absent = records.filter((record) => arrivalStatus(record) === 'absent').length;
    const rate = enrolled ? Math.round((Math.min(present + late, enrolled) / enrolled) * 1000) / 10 : 0;
    return { section: section.name, adviser: section.adviser || section.teacherName || section.teacher || '—', enrolled, present, late, absent, rate };
  }), [sections, roster, filteredAttendance]);

  function downloadReport(format, title) {
    if (format === 'PDF') { window.print(); return; }
    const attendanceRows = [['Student ID', 'Date', 'Section', ...PERIODS.flatMap((period) => [`${period} Time`, `${period} Status`]), 'SMS'], ...filteredAttendance.map((record) => [record.studentCode || record.studentId, record.date, record.sectionId, ...PERIODS.flatMap((period) => { const scan = getPeriodScan(record, period); return [scan?.time || '', scan?.status || '']; }), record.smsStatus || ''])];
    const smsRows = [['Recipient', 'Message', 'Status', 'Sent At'], ...smsLogs.map((record) => [record.recipient || record.phone, record.message, record.status, record.createdAt || record.sentAt])];
    const rows = title === 'SMS Logs CSV' ? smsRows : attendanceRows;
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')}`;
    const extension = format === 'XLS' ? 'xls.csv' : 'csv';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title === 'SMS Logs CSV' ? 'sms-logs' : 'attendance'}-${dateFrom}-to-${dateTo}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice(`${title} downloaded successfully.`);
  }

  const TABS = [['summary','Summary'],['section','By Section'],['export','Export']];

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Attendance summary, section breakdown, and data exports.</p>
        </div>
      </div>

      {notice && <Alert type="success" onClose={() => setNotice('')} dismissAfter={4000} className="mb-4">{notice}</Alert>}

      {/* Date range */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <span style={{ fontFamily:'Work Sans', fontWeight:600, fontSize:'.82rem', color:'var(--navy-800)' }}>Date Range</span>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0">From</label>
          <input type="date" className="field-input" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} style={{ width:'auto' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0">To</label>
          <input type="date" className="field-input" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} style={{ width:'auto' }} />
        </div>
        <Button variant="primary" size="sm" onClick={() => { setGenerated(true); setNotice('Report generated successfully.'); }}>Generate Report</Button>
        {generated && <span className="badge badge-navy">Generated from live records</span>}
      </div>

      {/* Tabs */}
      <div className="reports-tabs" role="tablist" aria-label="Report views">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`reports-tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="report-summary-layout">
          <section className="card report-block">
            <div className="card-header">
              <span className="card-title">Report Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="report-summary__table">
                <thead>
                  <tr><th>Metric</th><th className="num">Count</th><th className="num">Percentage</th></tr>
                </thead>
                <tbody>
                  <tr><td>Enrolled students</td><td className="num">{totals.enrolled}</td><td className="num">—</td></tr>
                  <tr><td>Present</td><td className="num">{totals.present}</td><td className="num">{totals.enrolled ? `${(Math.min(totals.present, totals.enrolled) / totals.enrolled * 100).toFixed(1)}%` : '—'}</td></tr>
                  <tr><td>Late</td><td className="num">{totals.late}</td><td className="num">{totals.enrolled ? `${(Math.min(totals.late, totals.enrolled) / totals.enrolled * 100).toFixed(1)}%` : '—'}</td></tr>
                  <tr><td>Absent</td><td className="num">{totals.absent}</td><td className="num">{totals.enrolled ? `${(totals.absent / totals.enrolled * 100).toFixed(1)}%` : '—'}</td></tr>
                  <tr className="report-summary__total"><td>Overall attendance</td><td className="num">{Math.min(totals.present + totals.late, totals.enrolled)}</td><td className="num">{overallRate}%</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card report-block">
            <div className="card-header">
              <span className="card-title">School-wide Attendance Rate</span>
              <span className="report-rate__value">{overallRate}%</span>
            </div>
            <div className="report-rate">
              <div className="report-rate__track">
                <div className="report-rate__fill" style={{ width: `${Math.min(Number(overallRate), 100)}%` }} />
              </div>
              <div className="report-rate__scale"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
          </section>
        </div>
      )}

      {tab==='section' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full report-section-table">
              <thead>
                <tr>
                  <th>Section</th><th>Adviser</th>
                  <th style={{textAlign:'center'}}>Enrolled</th>
                  <th style={{textAlign:'center'}}>Present</th>
                  <th style={{textAlign:'center'}}>Late</th>
                  <th style={{textAlign:'center'}}>Absent</th>
                  <th>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {sectionReport.map(r => (
                    <tr key={r.section}>
                      <td style={{ fontWeight:600, fontSize:'.875rem' }}>{r.section}</td>
                      <td style={{ fontSize:'.85rem', color:'var(--text-sub)' }}>{r.adviser}</td>
                      <td style={{ textAlign:'center', fontFamily:'JetBrains Mono', fontSize:'.85rem' }}>{r.enrolled}</td>
                      <td style={{ textAlign:'center', fontFamily:'JetBrains Mono', fontSize:'.85rem', color:'var(--green-600)', fontWeight:500 }}>{r.present}</td>
                      <td style={{ textAlign:'center', fontFamily:'JetBrains Mono', fontSize:'.85rem', color:'#d97706', fontWeight:500 }}>{r.late}</td>
                      <td style={{ textAlign:'center', fontFamily:'JetBrains Mono', fontSize:'.85rem', color:'#dc2626', fontWeight:500 }}>{r.absent}</td>
                      <td className="num mono">{r.rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                {!sectionReport.length && <tr><td colSpan="7" className="empty-row">No sections available.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='export' && (
        <div className="report-export-grid">
          {[
            { title:'CSV Export',          desc:'Daily attendance records, flat format.',       format:'CSV', Icon:Download },
            { title:'Excel-compatible CSV',desc:'Formatted for Excel or Google Sheets import.', format:'XLS', Icon:Download },
            { title:'PDF Report',          desc:'Print-ready attendance summary.',              format:'PDF', Icon:FileText },
            { title:'SMS Logs CSV',        desc:'Admin only — notification history export.',   format:'CSV', Icon:Download },
          ].map(e=>(
            <div key={e.title} className="report-export-card">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background:'var(--navy-50)' }}>
                  <e.Icon size={17} style={{ color:'var(--navy-800)' }} />
                </div>
                <span style={{ fontFamily:'JetBrains Mono', background:'#f0f4f8', color:'var(--text-sub)', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 6px', fontSize:'.72rem' }}>
                  {e.format}
                </span>
              </div>
              <div style={{ fontFamily:'Work Sans', fontWeight:700, fontSize:'.9rem', color:'var(--navy-900)', marginBottom:'4px' }}>{e.title}</div>
              <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:'1rem' }}>{e.desc}</div>
              <Button variant="primary" size="sm" className="w-full" onClick={() => downloadReport(e.format, e.title)}>
                <Download size={13} /> Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
