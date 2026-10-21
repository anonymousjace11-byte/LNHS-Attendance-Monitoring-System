import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Info,
  MessageSquare,
  Percent,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import EmptyState from '../components/EmptyState';
import PageCover from '../components/PageCover';

const PERIODS = ['AM-1', 'AM-2', 'PM-1', 'PM-2'];
const VALID_STATUSES = ['present', 'late', 'absent'];

function getPeriodScan(record, period) {
  if (record.scans?.[period]) return record.scans[period];
  if (period === 'AM-1' && record.status) {
    return { time: record.time || null, status: record.status, smsStatus: record.smsStatus };
  }
  return null;
}

function getArrivalStatus(record) {
  return record.arrivalStatus || record.scans?.['AM-1']?.status || record.status || '';
}

function getDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

function getTimeMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > 23 || (meridiem && hour > 12)) return null;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (meridiem === 'PM' && hour < 12) hour += 12;
  return hour * 60 + minute;
}

function formatClock(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

function formatTimestamp(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
  }).format(date);
}

function getStatusClass(status) {
  return VALID_STATUSES.includes(status) ? status : 'unknown';
}

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className="dashboard-kpi">
      <div className="dashboard-kpi__top">
        <p>{label}</p>
        <span className={`dashboard-kpi__icon dashboard-kpi__icon--${tone}`}><Icon size={20} aria-hidden="true" /></span>
      </div>
      <strong className="dashboard-kpi__value">{value}</strong>
      <span className="dashboard-kpi__detail">{detail}</span>
    </article>
  );
}

function PanelHeading({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="dashboard-panel__heading">
      <div className="dashboard-panel__heading-copy">
        <div className="dashboard-panel__title-row">
          {Icon && <Icon size={17} aria-hidden="true" />}
          <h2>{title}</h2>
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function AttendanceLineChart({ data }) {
  const plotLeft = 48;
  const plotRight = 680;
  const plotTop = 16;
  const plotBottom = 194;
  const maximum = Math.max(1, ...data.flatMap((point) => [point.present, point.late, point.absent]));
  const scaleMaximum = Math.max(5, Math.ceil(maximum / 5) * 5);
  const xPosition = (index) => plotLeft + (index * (plotRight - plotLeft)) / Math.max(1, data.length - 1);
  const yPosition = (value) => plotBottom - (value / scaleMaximum) * (plotBottom - plotTop);
  const pointsFor = (key) => data.map((point, index) => `${xPosition(index)},${yPosition(point[key])}`).join(' ');
  const ticks = [scaleMaximum, Math.round(scaleMaximum / 2), 0];

  return (
    <svg className="dashboard-line-chart" viewBox="0 0 700 250" role="img" aria-label="Attendance scans by hour and status">
      {ticks.map((tick) => {
        const y = yPosition(tick);
        return <g key={tick}><line className="dashboard-chart__gridline" x1={plotLeft} y1={y} x2={plotRight} y2={y} /><text className="dashboard-chart__axis-label" x={plotLeft - 10} y={y + 4} textAnchor="end">{tick}</text></g>;
      })}
      <polyline className="dashboard-chart__line dashboard-chart__line--present" points={pointsFor('present')} />
      <polyline className="dashboard-chart__line dashboard-chart__line--late" points={pointsFor('late')} />
      <polyline className="dashboard-chart__line dashboard-chart__line--absent" points={pointsFor('absent')} />
      {data.map((point, index) => (
        <g key={point.hour}>
          <circle className="dashboard-chart__point dashboard-chart__point--present" cx={xPosition(index)} cy={yPosition(point.present)} r="3.5" />
          <circle className="dashboard-chart__point dashboard-chart__point--late" cx={xPosition(index)} cy={yPosition(point.late)} r="3.5" />
          <circle className="dashboard-chart__point dashboard-chart__point--absent" cx={xPosition(index)} cy={yPosition(point.absent)} r="3.5" />
          <text className="dashboard-chart__axis-label" x={xPosition(index)} y="222" textAnchor="middle">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}

function AttendanceDonut({ rate, total }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = rate === null ? 0 : circumference * Math.min(rate, 100) / 100;
  return (
    <svg className="dashboard-donut" viewBox="0 0 120 120" role="img" aria-label={rate === null ? 'No attendance rate available' : `Attendance rate ${rate.toFixed(1)} percent`}>
      <circle className="dashboard-donut__track" cx="60" cy="60" r={radius} />
      {total > 0 && <circle className="dashboard-donut__progress" cx="60" cy="60" r={radius} transform="rotate(-90 60 60)" strokeDasharray={`${progress} ${circumference}`} />}
      <text className="dashboard-donut__value" x="60" y="57" textAnchor="middle">{rate === null ? '—' : `${rate.toFixed(1)}%`}</text>
      <text className="dashboard-donut__caption" x="60" y="75" textAnchor="middle">ATTENDANCE</text>
    </svg>
  );
}

function WeeklyBarChart({ days }) {
  const plotTop = 14;
  const plotBottom = 160;
  const plotHeight = plotBottom - plotTop;
  const maximum = Math.max(1, ...days.map((day) => day.total));
  const scaleMaximum = Math.max(5, Math.ceil(maximum / 5) * 5);
  const barWidth = 38;
  const startX = 52;
  const spacing = 88;
  const ticks = [scaleMaximum, Math.round(scaleMaximum / 2), 0];

  return (
    <svg className="dashboard-week-chart" viewBox="0 0 700 220" role="img" aria-label="Seven-day attendance totals by status">
      {ticks.map((tick) => {
        const y = plotBottom - (tick / scaleMaximum) * plotHeight;
        return <g key={tick}><line className="dashboard-chart__gridline" x1="38" y1={y} x2="690" y2={y} /><text className="dashboard-chart__axis-label" x="30" y={y + 4} textAnchor="end">{tick}</text></g>;
      })}
      {days.map((day, index) => {
        const x = startX + index * spacing;
        const presentHeight = (day.present / scaleMaximum) * plotHeight;
        const lateHeight = (day.late / scaleMaximum) * plotHeight;
        const absentHeight = (day.absent / scaleMaximum) * plotHeight;
        return (
          <g key={day.date}>
            <rect className="dashboard-week-chart__bar dashboard-week-chart__bar--present" x={x} y={plotBottom - presentHeight} width={barWidth} height={presentHeight} />
            <rect className="dashboard-week-chart__bar dashboard-week-chart__bar--late" x={x} y={plotBottom - presentHeight - lateHeight} width={barWidth} height={lateHeight} />
            <rect className="dashboard-week-chart__bar dashboard-week-chart__bar--absent" x={x} y={plotBottom - presentHeight - lateHeight - absentHeight} width={barWidth} height={absentHeight} />
            <text className="dashboard-chart__axis-label" x={x + barWidth / 2} y="184" textAnchor="middle">{day.day}</text>
            <text className="dashboard-week-chart__date" x={x + barWidth / 2} y="202" textAnchor="middle">{day.shortDate}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState('week');
  const { students = [], attendance = [], sections = [], smsLogs = [], auditLogs = [], today, loading } = useData();

  const dashboardData = useMemo(() => {
    const studentById = new Map(students.map((student) => [student.id, student]));
    const sectionById = new Map(sections.map((section) => [section.id, section]));
    const todayAttendance = attendance.filter((record) => getDateKey(record.date) === today);
    const arrivals = todayAttendance
      .map((record) => getArrivalStatus(record))
      .filter((status) => VALID_STATUSES.includes(status));
    const present = arrivals.filter((status) => status === 'present').length;
    const late = arrivals.filter((status) => status === 'late').length;
    const absent = arrivals.filter((status) => status === 'absent').length;
    const arrivalTotal = present + late + absent;
    const attendanceRate = arrivalTotal ? ((present + late) / arrivalTotal) * 100 : null;

    const scansFromRecords = (records) => records.flatMap((record) => PERIODS.flatMap((period) => {
      const scan = getPeriodScan(record, period);
      if (!scan) return [];
      const status = scan.status || (period === 'AM-1' ? getArrivalStatus(record) : '');
      const time = scan.time || (period === 'AM-1' ? record.time : '') || '';
      const student = studentById.get(record.studentId);
      const sectionId = student?.sectionId || record.sectionId || '';
      return [{
        id: `${record.id}-${period}`,
        studentId: record.studentId,
        studentName: student?.name || record.studentId || '—',
        sectionName: student?.section || sectionById.get(sectionId)?.name || sectionId || '—',
        period,
        status,
        time,
        timeMinutes: getTimeMinutes(time),
      }];
    }));
    const todayScans = scansFromRecords(todayAttendance);
    const rangeStart = new Date(`${today}T12:00:00+08:00`);
    if (range === 'week') rangeStart.setUTCDate(rangeStart.getUTCDate() - ((rangeStart.getUTCDay() + 6) % 7));
    if (range === 'month') rangeStart.setUTCDate(1);
    const rangeStartKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(rangeStart);
    const rangeAttendance = attendance.filter((record) => {
      const recordDate = getDateKey(record.date);
      return recordDate >= rangeStartKey && recordDate <= today;
    });
    const rangeScans = range === 'today' ? todayScans : scansFromRecords(rangeAttendance);

    const hourlyScans = Array.from({ length: 13 }, (_, index) => ({
      hour: index + 6,
      label: index + 6 === 12 ? '12 PM' : `${(index + 6) % 12 || 12} ${index + 6 < 12 ? 'AM' : 'PM'}`,
      present: 0,
      late: 0,
      absent: 0,
    }));
    rangeScans.forEach((scan) => {
      if (scan.timeMinutes === null || !VALID_STATUSES.includes(scan.status)) return;
      const hour = Math.floor(scan.timeMinutes / 60);
      if (hour >= 6 && hour <= 18) hourlyScans[hour - 6][scan.status] += 1;
    });

    const timedArrivals = todayScans.filter((scan) => scan.period === 'AM-1' && ['present', 'late'].includes(scan.status) && scan.timeMinutes !== null);
    const averageArrival = timedArrivals.length
      ? Math.round(timedArrivals.reduce((total, scan) => total + scan.timeMinutes, 0) / timedArrivals.length)
      : null;
    const todayHourlyCounts = new Map();
    todayScans.forEach((scan) => {
      if (scan.timeMinutes === null) return;
      const hour = Math.floor(scan.timeMinutes / 60);
      if (hour >= 6 && hour <= 18) todayHourlyCounts.set(hour, (todayHourlyCounts.get(hour) || 0) + 1);
    });
    const peakHour = [...todayHourlyCounts.entries()].reduce((peak, [hour, count]) => (
      count > peak.count ? { hour, count } : peak
    ), { hour: null, count: 0 });

    const todaySms = smsLogs.filter((record) => getDateKey(record.createdAt || record.sentAt || record.date) === today);
    const todayAtNoon = new Date(`${today}T12:00:00+08:00`);
    const weeklyTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayAtNoon);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
      const records = attendance.filter((record) => getDateKey(record.date) === dateKey);
      const counts = records.reduce((result, record) => {
        const status = getArrivalStatus(record);
        if (VALID_STATUSES.includes(status)) result[status] += 1;
        return result;
      }, { present: 0, late: 0, absent: 0 });
      return {
        date: dateKey,
        day: new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' }).format(date),
        shortDate: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(date),
        ...counts,
        total: counts.present + counts.late + counts.absent,
      };
    });

    const recentActivity = [...todayScans]
      .sort((first, second) => (second.timeMinutes ?? -1) - (first.timeMinutes ?? -1))
      .slice(0, 10);
    const latestAudit = [...auditLogs].sort((first, second) => Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''))[0];
    const notifications = [
      ...todaySms
        .filter((record) => ['failed', 'pending'].includes(String(record.status || '').toLowerCase()))
        .map((record) => {
          const studentName = studentById.get(record.studentId)?.name || record.studentId || 'Student';
          const status = String(record.status).toLowerCase();
          return {
            id: `sms-${record.id}`,
            tone: status === 'failed' ? 'danger' : 'warning',
            title: `SMS ${status} for ${studentName}`,
            time: formatTimestamp(record.createdAt || record.sentAt),
            sortValue: Date.parse(record.createdAt || record.sentAt || '') || 0,
          };
        }),
      ...todayAttendance
        .filter((record) => {
          const student = studentById.get(record.studentId);
          return !(student?.sectionId || student?.section || record.sectionId);
        })
        .map((record) => ({
          id: `section-${record.id}`,
          tone: 'warning',
          title: `Attendance record missing section for ${studentById.get(record.studentId)?.name || record.studentId || 'student'}`,
          time: record.time || 'Today',
          sortValue: getTimeMinutes(record.time) || 0,
        })),
      ...(latestAudit ? [{
        id: `audit-${latestAudit.id}`,
        tone: 'info',
        title: `Audit activity: ${latestAudit.action || 'Administrative event'}`,
        time: formatTimestamp(latestAudit.createdAt),
        sortValue: Date.parse(latestAudit.createdAt || '') || 0,
      }] : []),
    ].sort((first, second) => second.sortValue - first.sortValue).slice(0, 5);

    return {
      todayAttendanceCount: todayAttendance.length,
      todayScans, todaySms, present, late, absent, arrivalTotal, attendanceRate,
      hourlyScans, averageArrival, peakHour, weeklyTrend, recentActivity, notifications,
      studentsTotal: students.length,
    };
  }, [attendance, auditLogs, range, sections, smsLogs, students, today]);

  const hourlyTotal = dashboardData.hourlyScans.reduce((total, point) => total + point.present + point.late + point.absent, 0);
  const weeklyTotal = dashboardData.weeklyTrend.reduce((total, day) => total + day.total, 0);
  const peakWindow = dashboardData.peakHour.hour === null
    ? '—'
    : `${formatClock(dashboardData.peakHour.hour * 60)} – ${formatClock((dashboardData.peakHour.hour + 1) * 60)}`;
  const lateRatio = dashboardData.arrivalTotal ? `${((dashboardData.late / dashboardData.arrivalTotal) * 100).toFixed(1)}%` : '—';
  const attendanceRateLabel = dashboardData.attendanceRate === null ? '—' : `${dashboardData.attendanceRate.toFixed(1)}%`;
  const quickActions = [
    { title: 'Scan QR Code', subtitle: 'Open Scanner', icon: QrCode, path: '/scanner' },
    { title: 'View Reports', subtitle: 'Attendance & Analytics', icon: BarChart3, path: '/reports' },
    { title: 'Manage Students', subtitle: 'Add / Edit / View', icon: Users, path: '/students' },
    { title: 'SMS Logs', subtitle: 'View message history', icon: MessageSquare, path: '/sms-logs' },
  ];

  return (
    <div className="dashboard-page animate-fade-in">
      <PageCover
        eyebrow="Administrator Panel"
        title="Dashboard"
        subtitle="Monitor attendance, manage records, and keep LNHS connected."
      />

      <section className="dashboard-kpi-strip" aria-label="Today's key metrics">
        <MetricCard icon={Users} label="Total Students Enrolled" value={loading && !dashboardData.studentsTotal ? '—' : dashboardData.studentsTotal} detail="students in roster" tone="navy" />
        <MetricCard icon={QrCode} label="Attendance Scans Today" value={loading && !dashboardData.todayAttendanceCount ? '—' : dashboardData.todayAttendanceCount} detail="attendance records today" tone="blue" />
        <MetricCard icon={CheckCircle} label="On-time Arrivals" value={loading && !dashboardData.arrivalTotal ? '—' : dashboardData.present} detail="AM-1, present status" tone="positive" />
        <MetricCard icon={AlertTriangle} label="Late Arrivals" value={loading && !dashboardData.arrivalTotal ? '—' : dashboardData.late} detail="AM-1, late status" tone="warning" />
        <MetricCard icon={Percent} label="Today's Attendance Rate" value={loading && !dashboardData.arrivalTotal ? '—' : attendanceRateLabel} detail={`${dashboardData.arrivalTotal} recorded AM-1 arrivals`} tone="teal" />
        <MetricCard icon={MessageSquare} label="SMS Alerts Sent Today" value={loading && !dashboardData.todaySms.length ? '—' : dashboardData.todaySms.length} detail="SMS log records today" tone="slate" />
      </section>

      <div className="dashboard-main-grid">
        <section className="dashboard-panel">
          <PanelHeading
            icon={Activity}
            title="Attendance Overview"
            subtitle="Recorded attendance scans by hour and status"
            action={(
              <label className="dashboard-range">
                <Calendar size={13} aria-hidden="true" />
                <select aria-label="Attendance chart range" value={range} onChange={(event) => setRange(event.target.value)}>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </label>
            )}
          />
          <div className="dashboard-legend" aria-label="Chart legend">
            <span><i className="dashboard-legend__dot dashboard-legend__dot--present" />Present</span>
            <span><i className="dashboard-legend__dot dashboard-legend__dot--late" />Late</span>
            <span><i className="dashboard-legend__dot dashboard-legend__dot--absent" />Absent</span>
          </div>
          {loading && !hourlyTotal ? <EmptyState icon={Activity} title="Loading attendance data" /> : hourlyTotal ? <AttendanceLineChart data={dashboardData.hourlyScans} /> : <EmptyState icon={Activity} title="No attendance data for this range" />}
        </section>

        <section className="dashboard-panel dashboard-panel--activity">
          <PanelHeading icon={Users} title="Recent Attendance Activity" action={<button className="dashboard-text-link" type="button" onClick={() => navigate('/attendance')}>View All <span aria-hidden="true">→</span></button>} />
          {dashboardData.recentActivity.length ? (
            <div className="dashboard-table-wrap">
              <table className="dashboard-activity-table">
                <thead><tr><th>Student</th><th>Time</th><th className="dashboard-section-column">Section</th><th>Status</th></tr></thead>
                <tbody>{dashboardData.recentActivity.map((record) => (
                  <tr key={record.id}>
                    <td><span className="dashboard-activity-table__name">{record.studentName}</span><span className="dashboard-activity-table__period">{record.period}</span></td>
                    <td className="dashboard-activity-table__time">{record.time || '—'}</td>
                    <td className="dashboard-section-column">{record.sectionName}</td>
                    <td><span className={`dashboard-status dashboard-status--${getStatusClass(record.status)}`}>{record.status || 'Unknown'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState icon={Info} title={loading ? 'Loading attendance records' : 'No attendance scans today'} />}
        </section>

        <section className="dashboard-panel dashboard-panel--rate">
          <PanelHeading icon={Percent} title="Attendance Rate" subtitle="Based on recorded AM-1 arrival statuses" />
          <div className="dashboard-rate-layout">
            <div className="dashboard-rate-summary">
              <AttendanceDonut rate={dashboardData.attendanceRate} total={dashboardData.arrivalTotal} />
              <p>{dashboardData.present + dashboardData.late} <span>/ {dashboardData.arrivalTotal}</span></p>
              <small>present or late / recorded arrivals</small>
            </div>
            <div className="dashboard-rate-details">
              <div className="dashboard-rate-breakdown">
                <div><span><i className="dashboard-legend__dot dashboard-legend__dot--present" />Present</span><strong>{dashboardData.present}</strong></div>
                <div><span><i className="dashboard-legend__dot dashboard-legend__dot--late" />Late</span><strong>{dashboardData.late}</strong></div>
                <div><span><i className="dashboard-legend__dot dashboard-legend__dot--absent" />Absent</span><strong>{dashboardData.absent}</strong></div>
              </div>
              <div className="dashboard-quick-stats">
                <h3>Quick Stats</h3>
                <div><span>Peak scan window</span><strong>{peakWindow}</strong><small>Highest timed scan count</small></div>
                <div><span>Average AM-1 arrival</span><strong>{formatClock(dashboardData.averageArrival)}</strong><small>Present or late scans with a time</small></div>
                <div><span>Late ratio</span><strong>{lateRatio}</strong><small>Late / recorded AM-1 arrivals</small></div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel dashboard-panel--notifications">
          <PanelHeading icon={ShieldCheck} title="System Notifications" subtitle="Derived from today's loaded records" action={<button className="dashboard-text-link" type="button" onClick={() => navigate('/sms-logs')}>SMS Logs <span aria-hidden="true">→</span></button>} />
          {dashboardData.notifications.length ? (
            <ul className="dashboard-notifications">{dashboardData.notifications.map((notification) => (
              <li key={notification.id}>
                <span className={`dashboard-notifications__dot dashboard-notifications__dot--${notification.tone}`} />
                <span className="dashboard-notifications__title">{notification.title}</span>
                <time>{notification.time}</time>
              </li>
            ))}</ul>
          ) : <EmptyState icon={CheckCircle} title={loading ? 'Loading system records' : 'No logged alerts'} subtitle="No failed or pending SMS or missing-section attendance records were found today." />}
        </section>

        <section className="dashboard-panel">
          <PanelHeading icon={BarChart3} title="Attendance Trend" subtitle="AM-1 arrival status · last 7 days" />
          <div className="dashboard-legend" aria-label="Chart legend">
            <span><i className="dashboard-legend__dot dashboard-legend__dot--present" />Present</span>
            <span><i className="dashboard-legend__dot dashboard-legend__dot--late" />Late</span>
            <span><i className="dashboard-legend__dot dashboard-legend__dot--absent" />Absent</span>
          </div>
          {loading && !weeklyTotal ? <EmptyState icon={BarChart3} title="Loading weekly attendance" /> : weeklyTotal ? <WeeklyBarChart days={dashboardData.weeklyTrend} /> : <EmptyState icon={BarChart3} title="No attendance data for the last 7 days" />}
        </section>
      </div>

      <section className="dashboard-quick-actions" aria-label="Quick actions">
        {quickActions.map(({ title, subtitle, icon: Icon, path }) => (
          <button className="dashboard-action" type="button" key={path} onClick={() => navigate(path)}>
            <span className="dashboard-action__icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="dashboard-action__copy"><strong>{title}</strong><small>{subtitle}</small></span>
          </button>
        ))}
      </section>
    </div>
  );
}