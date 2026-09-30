import { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Users } from 'lucide-react';
import Alert from '../components/Alert';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { staffApiGet } from '../context/DataContext';

const EMPTY_DATA = { sections: [], students: [], todayBySection: {} };

export default function TeacherPortal() {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadTeacherData() {
      setLoading(true);
      setError('');
      try {
        const [sectionResult, studentResult] = await Promise.all([
          staffApiGet('/teacher/sections'),
          staffApiGet('/students'),
        ]);
        const sections = sectionResult.sections || [];
        const dailyResults = await Promise.all(sections.map(async (section) => [
          section.id,
          await staffApiGet(`/attendance/section/${encodeURIComponent(section.id)}/today`),
        ]));

        if (!active) return;
        setData({
          sections,
          students: studentResult.students || [],
          todayBySection: Object.fromEntries(dailyResults),
        });
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load your classes.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTeacherData();
    return () => { active = false; };
  }, [user?.uid, refreshKey]);

  const attendanceByStudent = new Map();
  Object.values(data.todayBySection).forEach((daily) => {
    (daily.attendance || []).forEach((record) => attendanceByStudent.set(record.studentId, record.status));
  });

  const presentToday = Object.values(data.todayBySection).reduce((total, daily) => total + (daily.present || 0), 0);
  const lateToday = Object.values(data.todayBySection).reduce((total, daily) => total + (daily.late || 0), 0);

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-sub">Assigned sections and today&apos;s attendance.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-3 flex items-center gap-3">
          <BookOpen size={18} aria-hidden="true" />
          <div><div className="text-sm text-muted">Assigned sections</div><strong>{loading ? '—' : data.sections.length}</strong></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <Users size={18} aria-hidden="true" />
          <div><div className="text-sm text-muted">Students</div><strong>{loading ? '—' : data.students.length}</strong></div>
        </div>
        <div className="card p-3">
          <div className="text-sm text-muted">Present / late today</div>
          <strong>{loading ? '—' : `${presentToday} / ${lateToday}`}</strong>
        </div>
      </div>

      {loading ? (
        <div className="card p-4 text-muted">Loading your classes…</div>
      ) : data.sections.length === 0 ? (
        <div className="card p-4 text-muted">No sections are assigned to your teacher account.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {data.sections.map((section) => {
              const daily = data.todayBySection[section.id] || {};
              const studentsInSection = data.students.filter((student) => {
                const assignedSection = student.sectionId || student.section;
                return assignedSection === section.id || assignedSection === section.name;
              });
              return (
                <section key={section.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{section.name || 'Assigned section'}</h2>
                      <p className="text-sm text-muted">{section.grade ? `Grade ${section.grade}` : ''}{section.strand ? ` · ${section.strand}` : ''}{section.room ? ` · ${section.room}` : ''}</p>
                    </div>
                    <span className="text-sm text-muted">{studentsInSection.length} students</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div><strong>{daily.present || 0}</strong><div className="text-xs text-muted">Present</div></div>
                    <div><strong>{daily.late || 0}</strong><div className="text-xs text-muted">Late</div></div>
                    <div><strong>{daily.absent || 0}</strong><div className="text-xs text-muted">Absent</div></div>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="card overflow-hidden">
            <div className="card-header"><strong>Assigned students</strong></div>
            {data.students.length === 0 ? (
              <div className="p-4 text-muted">No students are currently enrolled in your assigned sections.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead><tr><th>Student</th><th>Student No.</th><th>Section</th><th>Today</th></tr></thead>
                  <tbody>
                    {data.students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name || 'Student'}</td>
                        <td>{student.studentCode || student.code || student.id}</td>
                        <td>{student.section || data.sections.find((section) => section.id === student.sectionId)?.name || '—'}</td>
                        <td>{attendanceByStudent.get(student.id) || 'Not recorded'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}