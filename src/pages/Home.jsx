import { useNavigate } from 'react-router-dom';
import { AlarmClock, Clock, Info, LogIn, MessageSquare, QrCode, ShieldCheck } from 'lucide-react';
import Button from '../components/Button';
import lnhsLogo from '../imports/LNHS LOGO.png';

const features = [
  { icon: Clock, text: 'Four scans each school day: AM-1, AM-2, PM-1, and PM-2.' },
  { icon: AlarmClock, text: 'AM-1 on-time cutoff at 7:30 AM.' },
  { icon: MessageSquare, text: 'Automatic SMS notifications to parents for Present, Late, and Absent status.' },
  { icon: ShieldCheck, text: 'Section-scoped teacher access with administrator oversight.' },
  { icon: QrCode, text: 'USB QR scanners using keyboard-wedge (HID) input are supported.' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="login-page animate-fade-in">
      <section className="login-card">
        <div className="login-card__gov">
          <div className="login-card__gov-line">Republic of the Philippines</div>
          <div className="login-card__gov-line">Department of Education</div>
          <div className="login-card__gov-line login-card__gov-line--sm">
            Region IV-B MIMAROPA · Division of Romblon
          </div>
        </div>

        <div className="login-card__school">
          <div className="login-card__seal">
            <img src={lnhsLogo} alt="Looc National High School seal" />
          </div>
          <h1 className="login-card__school-name">Looc National High School</h1>
          <p className="login-card__school-sub">
            Mataas na Paaralang Nasyonal ng Looc · Est. 1948
          </p>
          <p className="login-card__school-id">School ID: 301765</p>
          <p className="login-card__system">Attendance Monitoring System</p>
        </div>

        <div className="login-card__form-wrap">
          <p className="page-sub">
            A QR-based attendance monitoring system with automatic parent SMS notifications for Looc National High School (Senior High School). Students scan their QR ID at four daily checkpoints; the system records on-time, late, and absent status, and notifies parents or guardians.
          </p>
          <div className="home-actions">
            <Button variant="primary" onClick={() => navigate('/login')}>
              <LogIn size={14} aria-hidden="true" /> Sign In
            </Button>
            <Button variant="outline" onClick={() => navigate('/about')}>
              <Info size={14} aria-hidden="true" /> About the System
            </Button>
          </div>
        </div>

        <div className="login-card__footer">
          <span>v2.0</span>
          <span>Copyright {new Date().getFullYear()} LNHS</span>
        </div>
      </section>

      <section className="card home-features" aria-labelledby="home-features-title">
        <div className="card-header">
          <span id="home-features-title" className="card-title">System Features</span>
        </div>
        {features.map(({ icon: Icon, text }) => (
          <div className="home-feature" key={text}>
            <Icon size={16} aria-hidden="true" />
            <span>{text}</span>
          </div>
        ))}
      </section>

      <p className="login-page__foot">For official use of LNHS faculty and staff only.</p>
    </main>
  );
}