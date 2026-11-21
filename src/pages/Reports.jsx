import { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import Button from '../components/Button';
import Alert from '../components/Alert';
import EmptyState, { EmptyTableRow } from '../components/EmptyState';
import PageCover from '../components/PageCover';
import { useData } from '../context/DataContext';
import { downloadCsv } from '../utils/csvExport';

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

function getSf2Mark(status) {
  return ({ present: 'P', late: 'L', absent: 'A', excused: 'E', 'pending-sync': 'Q' })[String(status || '').toLowerCase()] || '';
}

export default function Reports() {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo]     = useState(today);
  const [datePreset, setDatePreset] = useState('month');
  const [tab, setTab]           = useState('summary');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [exportScope, setExportScope] = useState('full');
  const [exportSectionId, setExportSectionId] = useState('');
  const [exportTrack, setExportTrack] = useState('');
  const [monthlyMonth, setMonthlyMonth] = useState(today.slice(0, 7));
  const [monthlySectionId, setMonthlySectionId] = useState('');
  const [monthlySchoolName, setMonthlySchoolName] = useState('Looc National High School');
  const [monthlySchoolId, setMonthlySchoolId] = useState('');
  const [monthlyDistrict, setMonthlyDistrict] = useState('Looc');
  const [monthlyDivision, setMonthlyDivision] = useState('Romblon');
  const [monthlyRegion, setMonthlyRegion] = useState('MIMAROPA');
  const [monthlyGenerated, setMonthlyGenerated] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [notice, setNotice] = useState('');
  const { students, attendance, sections, smsLogs, offlineAttendance } = useData();
  const attendanceWithQueued = useMemo(() => {
    const queued = offlineAttendance.map((event) => ({
      id: `offline-${event.eventId}`,
      studentId: event.studentId,
      studentCode: students.find((student) => student.id === event.studentId)?.studentCode || '',
      sectionId: students.find((student) => student.id === event.studentId)?.sectionId || students.find((student) => student.id === event.studentId)?.section || '',
      date: event.date,
      time: event.time,
      period: event.period,
      status: 'pending-sync',
      smsStatus: 'pending',
      pendingSync: true,
      scans: { [event.period]: { time: event.time, status: 'pending-sync' } },
    }));
    return [...attendance, ...queued];
  }, [attendance, offlineAttendance, students]);

  const [year, month, day] = today.split('-').map(Number);
  const todayDate = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (todayDate.getUTCDay() + 6) % 7;
  const mondayDate = new Date(todayDate);
  mondayDate.setUTCDate(mondayDate.getUTCDate() - mondayOffset);
  const weekStart = mondayDate.toISOString().slice(0, 10);

  function applyDatePreset(preset) {
    const rangeStart = preset === 'day' ? today : preset === 'week' ? weekStart : monthStart;
    setDateFrom(rangeStart);
    setDateTo(today);
    setDatePreset(preset);
  }

  const activeStudents = students.filter((student) => student.active !== false);
  const roster = activeStudents.length ? activeStudents : students;
  const exportTrackOptions = useMemo(() => [...new Set(roster
    .map((student) => String(student.track || student.strand || '').trim())
    .filter(Boolean))].sort((first, second) => first.localeCompare(second)), [roster]);
  const exportRoster = useMemo(() => {
    const selectedSection = sections.find((section) => section.id === exportSectionId);
    return roster.filter((student) => {
      const studentSection = String(student.sectionId || student.section || student.sectionName || '');
      const matchesSection = !exportSectionId
        || studentSection === exportSectionId
        || studentSection === selectedSection?.name;
      const studentTrack = String(student.track || student.strand || '').trim();
      const matchesTrack = !exportTrack || studentTrack === exportTrack;
      return matchesSection && matchesTrack;
    });
  }, [roster, sections, exportSectionId, exportTrack]);
  const filteredAttendance = useMemo(
    () => attendanceWithQueued.filter((record) => record.date >= dateFrom && record.date <= dateTo),
    [attendanceWithQueued, dateFrom, dateTo],
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

  const sortedStudents = useMemo(() => [...students].sort((first, second) => {
    const firstName = String(first.name || first.studentCode || first.code || first.id || '');
    const secondName = String(second.name || second.studentCode || second.code || second.id || '');
    return firstName.localeCompare(secondName);
  }), [students]);
  const monthlySection = sections.find((section) => section.id === monthlySectionId) || sections[0] || null;
  const monthlyStudents = useMemo(() => {
    if (!monthlySection) return [];
    return roster
      .filter((student) => {
        const studentSection = student.sectionId || student.section;
        return studentSection === monthlySection.id || studentSection === monthlySection.name;
      })
      .sort((first, second) => String(first.name || first.studentCode || first.id || '').localeCompare(String(second.name || second.studentCode || second.id || '')));
  }, [roster, monthlySection]);
  const monthlyParts = monthlyMonth.split('-').map(Number);
  const monthlyYear = monthlyParts[0] || year;
  const monthlyMonthNumber = monthlyParts[1] || month;
  const monthlyDayCount = new Date(Date.UTC(monthlyYear, monthlyMonthNumber, 0)).getUTCDate();
  const monthlyDateKeys = useMemo(() => Array.from({ length: monthlyDayCount }, (_, index) => `${monthlyMonth}-${String(index + 1).padStart(2, '0')}`), [monthlyMonth, monthlyDayCount]);
  const monthlyDayStatuses = useMemo(() => {
    const studentIds = new Set(monthlyStudents.map((student) => student.id));
    const statuses = new Map();
    attendanceWithQueued.forEach((record) => {
      const date = String(record.date || '').slice(0, 10);
      if (!date.startsWith(`${monthlyMonth}-`) || !studentIds.has(record.studentId)) return;
      statuses.set(`${record.studentId}:${date}`, record.pendingSync ? 'pending-sync' : arrivalStatus(record));
    });
    return statuses;
  }, [attendanceWithQueued, monthlyMonth, monthlyStudents]);
  const monthlyRows = useMemo(() => monthlyStudents.map((student, index) => {
    const marks = monthlyDateKeys.map((date) => getSf2Mark(monthlyDayStatuses.get(`${student.id}:${date}`)));
    return {
      student,
      number: index + 1,
      marks,
      absent: marks.filter((mark) => mark === 'A').length,
      present: marks.filter((mark) => mark === 'P' || mark === 'L').length,
      late: marks.filter((mark) => mark === 'L').length,
      excused: marks.filter((mark) => mark === 'E').length,
      pending: marks.filter((mark) => mark === 'Q').length,
    };
  }), [monthlyStudents, monthlyDateKeys, monthlyDayStatuses]);
  const monthlyTotals = monthlyRows.reduce((totals, row) => ({
    absent: totals.absent + row.absent,
    present: totals.present + row.present,
    late: totals.late + row.late,
    excused: totals.excused + row.excused,
    pending: totals.pending + row.pending,
  }), { absent: 0, present: 0, late: 0, excused: 0, pending: 0 });
  const monthlySchoolYearStart = monthlyMonthNumber >= 6 ? monthlyYear : monthlyYear - 1;
  const monthlySchoolYear = `${monthlySchoolYearStart}-${monthlySchoolYearStart + 1}`;
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const selectedStudentName = selectedStudent?.name || '—';
  const selectedStudentSection = selectedStudent?.sectionName || selectedStudent?.section || selectedStudent?.sectionId || 'Unassigned';
  const studentAttendance = useMemo(() => filteredAttendance
    .filter((record) => record.studentId === selectedStudentId)
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || ''))),
  [filteredAttendance, selectedStudentId]);
  const studentCounts = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, excused: 0 };
    studentAttendance.forEach((record) => {
      const status = arrivalStatus(record);
      if (status in counts) counts[status] += 1;
    });
    return counts;
  }, [studentAttendance]);
  const eligibleStudentDays = studentCounts.present + studentCounts.late + studentCounts.absent;
  const studentAttendanceRate = eligibleStudentDays
    ? ((studentCounts.present + studentCounts.late) / eligibleStudentDays * 100).toFixed(1)
    : null;
  const studentReportContent = !selectedStudentId
    ? <div className="card"><EmptyState icon={FileText} title="Select a student to view attendance." subtitle="Choose a student to see attendance by period." /></div>
    : !studentAttendance.length
      ? <div className="card"><EmptyState icon={FileText} title="No attendance records for this student in the selected range." subtitle="Try a different date range." /></div>
      : (
        <section className="card report-block">
          <div className="card-header">
            <span className="card-title">{selectedStudentName} · {selectedStudentSection}</span>
            <span className="report-rate__value">{studentAttendanceRate === null ? '—' : `${studentAttendanceRate}%`}</span>
          </div>
          <p className="field-hint">
            Present: {studentCounts.present} · Late: {studentCounts.late} · Absent: {studentCounts.absent} · Excused: {studentCounts.excused} · Rate: {studentAttendanceRate === null ? '—' : `${studentAttendanceRate}%`}
          </p>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Date</th>{PERIODS.map((period) => <th key={period}>{period}</th>)}</tr>
              </thead>
              <tbody>
                {studentAttendance.map((record) => (
                  <tr key={record.id || `${record.studentId}-${record.date}`}>
                    <td className="mono">{record.date || '—'}</td>
                    {PERIODS.map((period) => {
                      const scan = getPeriodScan(record, period);
                      const status = String(scan?.status || '').toLowerCase();
                      return (
                        <td key={period}>
                          {scan ? (
                            <div className="grid gap-1 justify-items-start">
                              <span className="mono">{scan.time || '—'}</span>
                              <span className={`badge badge-${status}`}>{scan.status}</span>
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
  const exportRows = exportScope === 'selected-student' && selectedStudentId ? studentAttendance : filteredAttendance;

  async function downloadReport(format, title) {
    if (format === 'PDF') {
      window.print();
      setNotice('Use the browser print dialog to save this report as PDF.');
      return;
    }
    const reportStudents = exportScope === 'selected-student' && selectedStudentId
      ? students.filter((student) => student.id === selectedStudentId)
      : exportRoster;
    const recordsByStudentDate = new Map();
    exportRows.forEach((record) => {
      const key = `${record.studentId}:${record.date}`;
      const combined = recordsByStudentDate.get(key) || { ...record, scans: {} };
      PERIODS.forEach((period) => {
        const scan = getPeriodScan(record, period);
        if (scan) combined.scans[period] = scan;
      });
      combined.smsStatus = record.smsStatus || combined.smsStatus || '';
      recordsByStudentDate.set(key, combined);
    });
    const startTime = Date.parse(`${dateFrom}T00:00:00Z`);
    const endTime = Date.parse(`${dateTo}T00:00:00Z`);
    const reportDates = [];
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= endTime) {
      for (let time = startTime; time <= endTime; time += 86400000) {
        reportDates.push(new Date(time).toISOString().slice(0, 10));
      }
    }
    const attendanceRows = [
      ['Student ID', 'Student Name', 'Date', 'Section', ...PERIODS.flatMap((period) => [`${period} Time`, `${period} Status`]), 'SMS'],
      ...reportStudents.flatMap((student) => reportDates.map((date) => {
        const record = recordsByStudentDate.get(`${student.id}:${date}`) || { studentId: student.id, date, scans: {} };
        return [
          student.studentCode || student.code || student.id,
          student.name || '',
          date,
          student.sectionName || student.section || sections.find((section) => section.id === student.sectionId)?.name || '',
          ...PERIODS.flatMap((period) => {
            const scan = getPeriodScan(record, period);
            return [scan?.time || '', scan?.status || 'No record'];
          }),
          record.smsStatus || '',
        ];
      })),
    ];
    const smsRows = [['Recipient', 'Message', 'Status', 'Sent At'], ...smsLogs.map((record) => [record.recipient || record.phone, record.message, record.status, record.createdAt || record.sentAt])];
    const rows = title === 'SMS Logs CSV' ? smsRows : attendanceRows;
    const filename = `${title === 'SMS Logs CSV' ? 'sms-logs' : 'attendance'}-${dateFrom}-to-${dateTo}.csv`;
    downloadCsv(rows, filename);
    setNotice(`${title} downloaded successfully.`);
  }

  function generateMonthlyReport() {
    if (!monthlySection) {
      setNotice('Create or select a section before generating the monthly report.');
      return;
    }
    setMonthlyGenerated(true);
    setNotice(`Monthly register generated for ${monthlySection.name}.`);
  }

  function getMonthlyCsvRows() {
    const weekdayRow = monthlyDateKeys.map((date) => {
      const [dateYear, dateMonth, dateDay] = date.split('-').map(Number);
      return new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(dateYear, dateMonth - 1, dateDay)));
    });
    return [
      ['School', monthlySchoolName, 'School ID', monthlySchoolId],
      ['District', monthlyDistrict, 'Division', monthlyDivision, 'Region', monthlyRegion],
      ['School Year', monthlySchoolYear, 'Month', monthlyMonth, 'Grade', monthlySection?.grade || '', 'Section', monthlySection?.name || ''],
      ['Strand', monthlySection?.strand || '', 'Adviser', monthlySection?.adviser || monthlySection?.teacherName || monthlySection?.teacher || ''],
      [],
      ['No.', 'Learner ID', 'Learner Name', ...monthlyDateKeys.map((date) => Number(date.slice(-2))), 'Absent', 'Present', 'Late', 'Excused', 'Pending Sync'],
      ['', '', '', ...weekdayRow, '', '', '', '', ''],
      ...monthlyRows.map((row) => [row.number, row.student.studentCode || row.student.code || row.student.id, row.student.name || '', ...row.marks, row.absent, row.present, row.late, row.excused, row.pending]),
      ['', '', 'Class Total', ...Array(monthlyDateKeys.length).fill(''), monthlyTotals.absent, monthlyTotals.present, monthlyTotals.late, monthlyTotals.excused, monthlyTotals.pending],
    ];
  }

  function exportMonthlyCsv() {
    const sectionSlug = String(monthlySection?.name || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadCsv(getMonthlyCsvRows(), `sf2-${sectionSlug}-${monthlyMonth}.csv`);
    setNotice('Monthly class attendance CSV downloaded successfully.');
  }

  function printMonthlyReport() {
    document.body.classList.add('print-sf2');
    window.addEventListener('afterprint', () => document.body.classList.remove('print-sf2'), { once: true });
    window.print();
  }

  const TABS = [['summary','Summary'],['section','By Section'],['student','By Student'],['export','Export']];

  return (
    <div className="animate-fade-in">
      <PageCover eyebrow="Administrator Panel" title="Reports" subtitle="Attendance summary, section breakdown, and data exports." />

      {notice && <Alert type="success" onClose={() => setNotice('')} dismissAfter={4000} className="mb-4">{notice}</Alert>}

      {/* Date range */}
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <span style={{ fontFamily:'Work Sans', fontWeight:600, fontSize:'.82rem', color:'var(--text-primary)' }}>Date Range</span>
        <div className="flex items-center gap-1" role="group" aria-label="Date range presets">
          {[
            ['day', 'Day'],
            ['week', 'Week'],
            ['month', 'Month'],
          ].map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              aria-pressed={datePreset === preset}
              className={`reports-tab ${datePreset === preset ? 'is-active' : ''}`}
              onClick={() => applyDatePreset(preset)}
            >
              {label}
            </button>
          ))}
          {datePreset === 'custom' && <span className="field-hint ml-2">Custom</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0">From</label>
          <input type="date" className="field-input" value={dateFrom} onChange={(e)=>{setDateFrom(e.target.value);setDatePreset('custom');}} style={{ width:'auto' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="field-label mb-0">To</label>
          <input type="date" className="field-input" value={dateTo} onChange={(e)=>{setDateTo(e.target.value);setDatePreset('custom');}} style={{ width:'auto' }} />
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
                {!sectionReport.length && (
                  <EmptyTableRow
                    colSpan={7}
                    icon={FileText}
                    title="No section data for this range."
                    subtitle="Adjust the date range or add section records."
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='student' && (
        <div className="grid gap-4">
          <div className="card p-4">
            <label className="field-label" htmlFor="report-student">Student</label>
            <select
              id="report-student"
              className="field-input"
              value={selectedStudentId}
              onChange={(event) => { setSelectedStudentId(event.target.value); setExportScope('full'); }}
            >
              <option value="">Select a student</option>
              {sortedStudents.map((student) => {
                const name = student.name || '—';
                const section = student.sectionName || student.section || student.sectionId || 'Unassigned';
                return <option key={student.id} value={student.id}>{name} · {section}</option>;
              })}
            </select>
          </div>
          {studentReportContent}
        </div>
      )}

      {tab==='export' && (
        <>
          <section className="sf2-controls no-print">
            <div className="sf2-controls__heading">
              <div>
                <p className="sf2-eyebrow">Internal monthly attendance register</p>
                <h2>Class attendance export</h2>
              </div>
              <span className="badge badge-navy">Internal report</span>
            </div>
            <div className="sf2-control-grid">
              <label className="sf2-control-field">Month
                <input type="month" className="field-input" value={monthlyMonth} onChange={(event) => { setMonthlyMonth(event.target.value); setMonthlyGenerated(false); }} />
              </label>
              <label className="sf2-control-field">Section
                <select className="field-input" value={monthlySection?.id || ''} onChange={(event) => { setMonthlySectionId(event.target.value); setMonthlyGenerated(false); }}>
                  {!sections.length && <option value="">No sections available</option>}
                  {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </label>
              <label className="sf2-control-field">School name
                <input className="field-input" value={monthlySchoolName} onChange={(event) => setMonthlySchoolName(event.target.value)} />
              </label>
              <label className="sf2-control-field">School ID
                <input className="field-input" value={monthlySchoolId} onChange={(event) => setMonthlySchoolId(event.target.value)} />
              </label>
              <label className="sf2-control-field">District
                <input className="field-input" value={monthlyDistrict} onChange={(event) => setMonthlyDistrict(event.target.value)} />
              </label>
              <label className="sf2-control-field">Division
                <input className="field-input" value={monthlyDivision} onChange={(event) => setMonthlyDivision(event.target.value)} />
              </label>
              <label className="sf2-control-field">Region
                <input className="field-input" value={monthlyRegion} onChange={(event) => setMonthlyRegion(event.target.value)} />
              </label>
            </div>
            <div className="sf2-controls__footer">
                <span className="settings-section__hint">Marks: P present, L late, A absent, E excused, Q pending sync; blank means no record.</span>
              <Button variant="primary" size="sm" onClick={generateMonthlyReport} disabled={!monthlySection}>Generate Monthly Register</Button>
            </div>
          </section>

          {monthlyGenerated && monthlySection && (
            <section className="sf2-preview">
              <div className="sf2-preview-actions no-print">
                <span className="field-hint">{monthlyMonth} · {monthlySection.name} · {monthlyRows.length} learners</span>
                <div className="sf2-preview-actions__buttons">
                  <Button variant="outline" size="sm" onClick={exportMonthlyCsv}><Download size={13} /> Export Register CSV</Button>
                  <Button variant="primary" size="sm" onClick={printMonthlyReport}><Printer size={13} /> Print / Save PDF</Button>
                </div>
              </div>
              <p className="sf2-internal-note no-print">Internal attendance register. Confirm against the current DepEd Form 2 before official filing.</p>
              <div className="sf2-scroll">
                <article className="sf2-print-root">
                  <header className="sf2-report-heading">
                    <div>
                      <p>Department of Education · Learner Attendance</p>
                      <h2>Monthly Learner Attendance Report</h2>
                      <strong>Senior High School · Internal working report</strong>
                    </div>
                    <p className="sf2-report-heading__month">{new Date(Date.UTC(monthlyYear, monthlyMonthNumber - 1, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
                  </header>
                  <div className="sf2-meta">
                    <div><span>School</span><strong>{monthlySchoolName || '—'}</strong></div>
                    <div><span>School ID</span><strong>{monthlySchoolId || '—'}</strong></div>
                    <div><span>District</span><strong>{monthlyDistrict || '—'}</strong></div>
                    <div><span>Division</span><strong>{monthlyDivision || '—'}</strong></div>
                    <div><span>Region</span><strong>{monthlyRegion || '—'}</strong></div>
                    <div><span>School Year</span><strong>{monthlySchoolYear}</strong></div>
                    <div><span>Grade / Strand</span><strong>{monthlySection.grade || '—'} / {monthlySection.strand || '—'}</strong></div>
                    <div><span>Section / Adviser</span><strong>{monthlySection.name} / {monthlySection.adviser || monthlySection.teacherName || monthlySection.teacher || '—'}</strong></div>
                  </div>
                  <div className="sf2-table-scroll">
                    <table className="sf2-table">
                      <thead>
                        <tr>
                          <th rowSpan={3}>No.</th>
                          <th rowSpan={3}>Learner ID</th>
                          <th rowSpan={3} className="sf2-learner-name">Learner name</th>
                          <th colSpan={monthlyDateKeys.length}>Day of month</th>
                          <th colSpan={5}>Total for month</th>
                        </tr>
                        <tr>
                          {monthlyDateKeys.map((date) => <th key={`day-${date}`}>{Number(date.slice(-2))}</th>)}
                          <th rowSpan={2}>Absent</th>
                          <th rowSpan={2}>Present</th>
                          <th rowSpan={2}>Late</th>
                          <th rowSpan={2}>Excused</th>
                          <th rowSpan={2}>Pending</th>
                        </tr>
                        <tr>
                          {monthlyDateKeys.map((date) => {
                            const [dateYear, dateMonth, dateDay] = date.split('-').map(Number);
                            const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(dateYear, dateMonth - 1, dateDay)));
                            return <th key={`weekday-${date}`}>{weekday}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyRows.map((row) => (
                          <tr key={row.student.id}>
                            <td>{row.number}</td>
                            <td>{row.student.studentCode || row.student.code || row.student.id}</td>
                            <td className="sf2-learner-name">{row.student.name || '—'}</td>
                            {row.marks.map((mark, index) => <td key={monthlyDateKeys[index]}>{mark}</td>)}
                            <td>{row.absent}</td>
                            <td>{row.present}</td>
                            <td>{row.late}</td>
                            <td>{row.excused}</td>
                            <td>{row.pending}</td>
                          </tr>
                        ))}
                        {!monthlyRows.length && <tr><td colSpan={3 + monthlyDateKeys.length + 5}>No active learners are assigned to this section.</td></tr>}
                        <tr className="sf2-total-row">
                          <td colSpan={3}>Class total</td>
                          {monthlyDateKeys.map((date) => <td key={`total-${date}`}></td>)}
                          <td>{monthlyTotals.absent}</td>
                          <td>{monthlyTotals.present}</td>
                          <td>{monthlyTotals.late}</td>
                          <td>{monthlyTotals.excused}</td>
                          <td>{monthlyTotals.pending}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="sf2-legend"><strong>Legend:</strong> P Present · L Late · A Absent · E Excused · Q Pending sync · blank No record</div>
                  <footer className="sf2-signatures">
                    <div><span>Prepared by / Class Adviser</span><strong>{monthlySection.adviser || monthlySection.teacherName || monthlySection.teacher || ''}</strong></div>
                    <div><span>Checked by / School Head</span><strong></strong></div>
                  </footer>
                </article>
              </div>
            </section>
          )}

          <div className="card p-4 mb-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1" htmlFor="daily-export-section">
              <span className="field-label mb-0">Section</span>
              <select id="daily-export-section" className="field-input" value={exportSectionId} disabled={exportScope === 'selected-student'} onChange={(event) => setExportSectionId(event.target.value)}>
                <option value="">All sections</option>
                {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1" htmlFor="daily-export-track">
              <span className="field-label mb-0">Track / Strand</span>
              <select id="daily-export-track" className="field-input" value={exportTrack} disabled={exportScope === 'selected-student'} onChange={(event) => setExportTrack(event.target.value)}>
                <option value="">All tracks / strands</option>
                {exportTrackOptions.map((track) => <option key={track} value={track}>{track}</option>)}
              </select>
            </label>
            {selectedStudentId && (
              <label className="grid gap-1" htmlFor="report-export-scope">
                <span className="field-label mb-0">Export scope</span>
                <select id="report-export-scope" className="field-input" value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
                  <option value="full">Full report</option>
                  <option value="selected-student">Selected student only</option>
                </select>
              </label>
            )}
            <span className="field-hint">{exportScope === 'selected-student' ? 1 : exportRoster.length} learners in scope</span>
          </div>
          {selectedStudentId && exportScope === 'selected-student' && <div className="mb-4">{studentReportContent}</div>}
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
                    <e.Icon size={17} style={{ color:'var(--text-secondary)' }} />
                  </div>
                  <span style={{ fontFamily:'JetBrains Mono', background:'#f0f4f8', color:'var(--text-sub)', border:'1px solid var(--border)', borderRadius:'3px', padding:'1px 6px', fontSize:'.72rem' }}>
                    {e.format}
                  </span>
                </div>
                <div style={{ fontFamily:'Work Sans', fontWeight:700, fontSize:'.9rem', color:'var(--text-primary)', marginBottom:'4px' }}>{e.title}</div>
                <div style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:'1rem' }}>{e.desc}</div>
                <Button variant="primary" size="sm" className="w-full" onClick={() => downloadReport(e.format, e.title)}>
                  <Download size={13} /> Download
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
