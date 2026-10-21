import {
  Building2,
  Check,
  Clock3,
  Database,
  GraduationCap,
  HeartHandshake,
  QrCode,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import PageCover from '../components/PageCover';

const periods = [
  { code: 'AM-1', label: 'Morning arrival', detail: 'On time through 7:30 AM; later scans are marked late.' },
  { code: 'AM-2', label: 'Midday check-in', detail: 'A separate attendance record for the second morning period.' },
  { code: 'PM-1', label: 'Afternoon arrival', detail: 'The first afternoon checkpoint of the school day.' },
  { code: 'PM-2', label: 'End-of-day check-in', detail: 'The final attendance checkpoint.' },
];

const roles = [
  {
    icon: ShieldCheck,
    label: 'ADMINISTRATORS',
    title: 'A complete school view',
    detail: 'Manage student and staff records, monitor attendance, and review system activity.',
  },
  {
    icon: GraduationCap,
    label: 'TEACHERS',
    title: 'The classes that matter',
    detail: 'See students and attendance for assigned sections through a focused teacher portal.',
  },
  {
    icon: HeartHandshake,
    label: 'STUDENTS & FAMILIES',
    title: 'Simple scans, timely updates',
    detail: 'Students scan their QR ID; parents and guardians can receive attendance SMS updates.',
  },
];

export default function About() {
  return (
    <div className="about-page animate-fade-in">
      <PageCover
        eyebrow="LOOC NATIONAL HIGH SCHOOL · SYSTEM OVERVIEW"
        title="AttendSync"
        subtitle="A clearer picture of every school day, from the first QR scan to the last checkpoint."
      />

      <div className="about-page__body">
        <section className="about-intro" aria-labelledby="about-intro-title">
          <div className="about-intro__identity" aria-hidden="true">
            <span><QrCode size={36} strokeWidth={1.5} /></span>
            <small>LNHS</small>
          </div>
          <div className="about-intro__copy">
            <p className="about-kicker">Built around the school day</p>
            <h2 id="about-intro-title">One scan. One trusted attendance record.</h2>
            <p>
              AttendSync connects QR check-ins, school records, and family notifications in one
              school attendance system for Looc National High School, Senior High School, in Looc, Romblon.
            </p>
          </div>
          <dl className="about-summary" aria-label="Attendance at a glance">
            <div><dt>Checkpoints</dt><dd>04 <span>each day</span></dd></div>
            <div><dt>Scan rule</dt><dd><Check size={16} /> <span>Once per period</span></dd></div>
            <div><dt>AM-1 cutoff</dt><dd>7:30 <span>AM</span></dd></div>
          </dl>
        </section>

        <section className="about-section" aria-labelledby="about-day-title">
          <div className="about-section__heading">
            <div>
              <p className="about-kicker">01 / A day at a glance</p>
              <h2 id="about-day-title">Four moments. One school day.</h2>
            </div>
            <p>Each student can be recorded once in each attendance period.</p>
          </div>
          <div className="about-periods">
            {periods.map(({ code, label, detail }, index) => (
              <article className={`about-period about-period--${index + 1}`} key={code}>
                <div className="about-period__top"><span>0{index + 1}</span><Clock3 size={17} aria-hidden="true" /></div>
                <h3>{code}</h3>
                <p className="about-period__label">{label}</p>
                <p className="about-period__detail">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section about-section--workflow" aria-labelledby="about-workflow-title">
          <div className="about-section__heading">
            <div>
              <p className="about-kicker">02 / How it works</p>
              <h2 id="about-workflow-title">Attendance, connected.</h2>
            </div>
            <p>Made for fast check-ins and a dependable record behind every scan.</p>
          </div>
          <div className="about-workflow">
            <article>
              <span className="about-workflow__icon about-workflow__icon--gold"><QrCode size={20} aria-hidden="true" /></span>
              <div><h3>Scan at the gate</h3><p>A student presents their QR ID to a USB reader using keyboard-wedge input.</p></div>
            </article>
            <article>
              <span className="about-workflow__icon about-workflow__icon--green"><Database size={20} aria-hidden="true" /></span>
              <div><h3>Record by period</h3><p>Attendance is stored by student and checkpoint so each part of the day stays distinct.</p></div>
            </article>
            <article>
              <span className="about-workflow__icon about-workflow__icon--blue"><UsersRound size={20} aria-hidden="true" /></span>
              <div><h3>Keep families informed</h3><p>SMS notifications can share attendance updates with a student’s parent or guardian.</p></div>
            </article>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-roles-title">
          <div className="about-section__heading">
            <div>
              <p className="about-kicker">03 / The right view for each role</p>
              <h2 id="about-roles-title">One school. Clear responsibilities.</h2>
            </div>
          </div>
          <div className="about-roles">
            {roles.map(({ icon: Icon, label, title, detail }) => (
              <article className="about-role" key={label}>
                <Icon size={20} aria-hidden="true" />
                <p>{label}</p>
                <h3>{title}</h3>
                <span>{detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="about-foundation" aria-labelledby="about-foundation-title">
          <div className="about-foundation__mark"><Building2 size={21} aria-hidden="true" /></div>
          <div className="about-foundation__copy">
            <p className="about-kicker">04 / Trust and foundation</p>
            <h2 id="about-foundation-title">School information, handled with care.</h2>
            <p>
              Sign-in uses Firebase Authentication, records are stored in Firestore, and server-managed
              functions run through the Express API. Access follows school roles: administrators manage
              the system, while teachers are limited to their assigned sections.
            </p>
            <p className="about-foundation__privacy">
              Student and family information is handled under the Data Privacy Act of 2012
              (Republic Act No. 10173). For requests about access, correction, or deletion, contact the school registrar.
            </p>
          </div>
          <div className="about-foundation__stack" aria-label="System technology">
            <span>FIREBASE AUTH</span><span>FIRESTORE</span><span>EXPRESS API</span>
          </div>
        </section>
      </div>
    </div>
  );
}