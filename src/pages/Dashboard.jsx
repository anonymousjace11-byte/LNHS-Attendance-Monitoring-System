import { useNavigate } from 'react-router-dom';
import { BarChart2, ClipboardList, MessageSquare, Users, QrCode, CheckCircle2, Clock3, UserRoundX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Button from '../components/Button';

const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];

function getPeriodScan(record, period) {
  if (record.scans) return record.scans[period] || null;
  if (record.scans?.[period]) return record.scans[period];
  if (period === 'AM-1' && record.status) {
    return { time: record.time || null, status: record.status, smsStatus: record.smsStatus };
  }
  return null;
}

function arrivalStatus(record) {
  if ('arrivalStatus' in record) return record.arrivalStatus;
  if (record.scans) return record.scans['AM-1']?.status || '';
  return record.status;
}

function percentage(value, total) {
  if (!total) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { students, attendance, sections, teachers, smsLogs, today } = useData();

  const todayLabel = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const activeStudents = students.filter((student) => student.active !== false);
  const roster = activeStudents.length ? activeStudents : students;
  const todayAttendance = attendance.filter((record) => record.date === today);
  const present = todayAttendance.filter((record) => arrivalStatus(record) === 'present').length;
  const late = todayAttendance.filter((record) => arrivalStatus(record) === 'late').length;
  const absent = todayAttendance.filter((record) => arrivalStatus(record) === 'absent').length;
  const scansToday = todayAttendance.reduce((count, record) => count + PERIODS.filter((period) => getPeriodScan(record, period)).length, 0);
  const smsAlertsToday = smsLogs.filter((record) => String(record.createdAt || record.sentAt || '').slice(0, 10) === today).length;
  const overallPresent = present + late;
  const overallRate = roster.length
    ? Math.round((overallPresent / roster.length) * 1000) / 10
    : 0;
  const todayAtNoon = new Date(`${today}T12:00:00+08:00`);
  const weeklyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(todayAtNoon);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
    const dayRecords = attendance.filter((record) => record.date === dateKey);
    const attended = dayRecords.filter((record) => ['present', 'late'].includes(arrivalStatus(record))).length;
    const rate = roster.length ? attended / roster.length : 0;
    return {
      date: dateKey,
      day: date.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' }),
      rate,
      label: `${(rate * 100).toFixed(0)}%`,
    };
  });

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const recent = [...todayAttendance]
    .sort((first, second) => String(second.time).localeCompare(String(first.time)))
    .slice(0, 10)
    .map((record) => {
      const student = students.find((item) => item.id === record.studentId);
      const section = sectionById.get(student?.sectionId || record.sectionId);
      return {
        ...record,
        name: student?.name || record.studentId,
        sectionName: student?.section || section?.name || record.sectionId || '—',
      };
    });

  const sectionRows = sections.map((section) => {
    const members = roster.filter((student) => {
      const sectionId = student.sectionId || student.section;
      return sectionId === section.id || sectionId === section.name;
    });
    const records = todayAttendance.filter(
      (record) => record.sectionId === section.id || record.sectionId === section.name,
    );
    const adviser = teachers.find((teacher) => teacher.uid === section.teacherId)?.name;
    const sectionPresent = records.filter((record) => arrivalStatus(record) === 'present').length;
    const sectionLate = records.filter((record) => arrivalStatus(record) === 'late').length;
    const sectionAbsent = records.filter((record) => arrivalStatus(record) === 'absent').length;
    const sectionRate = members.length
      ? Math.round(((sectionPresent + sectionLate) / members.length) * 1000) / 10
      : 0;

    return {
      name: section.name,
      adviser: section.adviser || section.teacherName || section.teacher || adviser || '—',
      enrolled: members.length,
      present: sectionPresent,
      late: sectionLate,
      absent: sectionAbsent,
      rate: sectionRate,
    };
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{todayLabel}</p>
        </div>
        <div className="page-header__actions">
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
              <BarChart2 size={13} /> Reports
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/attendance')}>
            <ClipboardList size={13} /> Attendance Records
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/sms-logs')}>
            <MessageSquare size={13} /> SMS Logs
          </Button>
        </div>
      </div>

      <section className="card dash-block">
        <div className="card-header">
          <span className="card-title">Daily Attendance Summary</span>
        </div>
        <div className="dash-summary">
          <table className="dash-summary__table">
            <thead>
              <tr><th>Metric</th><th className="num">Count</th><th className="num">Percentage</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="dash-metric-label"><Users size={14} /> Enrolled students</span></td>
                <td className="num">{roster.length}</td>
                <td className="num">—</td>
              </tr>
              <tr>
                <td><span className="dash-metric-label"><CheckCircle2 size={14} /> On-time arrivals (AM-1)</span></td>
                <td className="num">{present}</td>
                <td className="num">{percentage(present, roster.length)}</td>
              </tr>
              <tr>
                <td><span className="dash-metric-label"><Clock3 size={14} /> Late arrivals (AM-1)</span></td>
                <td className="num">{late}</td>
                <td className="num">{percentage(late, roster.length)}</td>
              </tr>
              <tr><td><span className="dash-metric-label"><QrCode size={14} /> Period scans today</span></td><td className="num">{scansToday}</td><td className="num">—</td></tr>
              <tr><td><span className="dash-metric-label"><MessageSquare size={14} /> SMS attempts today</span></td><td className="num">{smsAlertsToday}</td><td className="num">—</td></tr>
              <tr>
                <td><span className="dash-metric-label"><UserRoundX size={14} /> Absent today</span></td>
                <td className="num">{absent}</td>
                <td className="num">{percentage(absent, roster.length)}</td>
              </tr>
              <tr className="dash-summary__total">
                <td>Overall attendance</td>
                <td className="num">{overallPresent}</td>
                <td className="num">{overallRate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card dash-block">
        <div className="card-header">
          <span className="card-title">Attendance Rate</span>
          <span className="dash-rate__value">{overallRate.toFixed(1)}%</span>
        </div>
        <div className="dash-rate">
          <div className="dash-rate__track">
            <div className="dash-rate__fill" style={{ width: `${Math.min(overallRate, 100)}%` }} />
          </div>
          <div className="dash-rate__scale">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      <section className="card dash-block">
        <div className="card-header"><span className="card-title">Weekly Attendance Trend</span><span className="scanner-log__count">AM-1 arrival rate · last 7 days</span></div>
        <div className="chart-bars" role="img" aria-label="AM-1 attendance rate for the past seven days">
          {weeklyTrend.map((day) => (
            <div className="chart-bar-wrap" key={day.date}>
              <span className="bar-value">{day.label}</span>
              <div className="chart-bar" style={{ height: `${Math.max(12, day.rate * 90)}px` }} />
              <span className="day-label">{day.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card dash-block">
        <div className="card-header">
          <span className="card-title">Recent Attendance — Today</span>
          <button type="button" className="text-link" onClick={() => navigate('/attendance')}>
            View all records →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table dash-table">
            <thead>
              <tr><th>Date</th><th>Student</th><th>Section</th>{PERIODS.map((period) => <th key={period}>{period}</th>)}<th>SMS</th></tr>
            </thead>
            <tbody>
              {recent.map((record) => (
                <tr key={record.id}>
                  <td data-label="Date" className="mono">{record.date}</td>
                  <td>
                    <div className="cell-name">{record.name}</div>
                    <div className="cell-sub mono">{record.id}</div>
                  </td>
                  <td data-label="Section">{record.sectionName}</td>
                  {PERIODS.map((period) => {
                    const scan = getPeriodScan(record, period);
                    return (
                      <td data-label={period} key={period}>
                        {scan ? <div className="period-cell"><span className="period-cell__time">{scan.time}</span><span className={`badge badge-${scan.status}`}>{scan.status === 'present' ? (period === 'AM-1' ? 'ON-TIME' : 'PRESENT') : scan.status.toUpperCase()}</span></div> : <span className="period-cell__empty">—</span>}
                      </td>
                    );
                  })}
                  <td data-label="SMS"><span className={`badge badge-${record.smsStatus || 'skipped'}`}>{String(record.smsStatus || 'skipped').toUpperCase()}</span></td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan="8" className="empty-row">No attendance recorded today.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card dash-block">
        <div className="card-header">
          <span className="card-title">Section Breakdown — Today</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table dash-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Adviser</th>
                <th className="num">Enrolled</th>
                <th className="num">Present</th>
                <th className="num">Late</th>
                <th className="num">Absent</th>
                <th className="num">Rate</th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((record) => (
                <tr key={record.name}>
                  <td className="cell-name">{record.name}</td>
                  <td>{record.adviser}</td>
                  <td className="num mono">{record.enrolled}</td>
                  <td className="num mono">{record.present}</td>
                  <td className="num mono">{record.late}</td>
                  <td className="num mono">{record.absent}</td>
                  <td className="num mono">{record.rate.toFixed(1)}%</td>
                </tr>
              ))}
              {!sectionRows.length && (
                <tr>
                  <td colSpan="7" className="empty-row">No sections available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
