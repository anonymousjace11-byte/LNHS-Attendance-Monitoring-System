import { useNavigate } from 'react-router-dom';
import { Clock3, Info, Keyboard, LogIn, MessageSquare, QrCode, ShieldCheck, Users } from 'lucide-react';
import Button from '../components/Button';
import lnhsLogo from '../imports/LNHS LOGO.png';
import lnhsBanner from '../imports/lnhs-banner.png';
import teamSealBadge from '../imports/Team Seal Badge.png';

const features = [
  { icon: QrCode, title: 'Four Scans Each School Day', description: 'AM-1, AM-2, PM-1, and PM-2.' },
  { icon: Clock3, title: 'Time-Based Classification', description: 'Automatically marks Present, Late, or Absent based on scan time.' },
  { icon: MessageSquare, title: 'Automatic SMS Notifications', description: 'Sends notifications to parents for Present, Late, and Absent status.' },
  { icon: Keyboard, title: 'USB QR Scanner Support', description: 'Works with USB QR scanners using keyboard-wedge (HID) input.' },
  { icon: Users, title: 'Section-Scoped Teacher Access', description: 'Teachers can only view students from their assigned section.' },
  { icon: ShieldCheck, title: 'Secure and Reliable', description: 'Built with secure authentication and data protection for students, teachers, and parents.' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="home-page">
      <header className="home-header">
        <div className="home-header__identity">
          <img className="home-header__badge" src={teamSealBadge} alt="LNHS team seal badge" />
          <span className="home-header__divider" aria-hidden="true" />
          <span className="home-header__school">
            <strong>Looc National High School</strong>
            <em>The School of Achievers</em>
          </span>
        </div>
        <div className="home-header__system">
          <span>Attendance Monitoring System</span>
          <span className="home-header__accent" aria-hidden="true" />
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <img className="home-hero__photo" src={lnhsBanner} alt="Looc National High School campus" />
        <div className="home-hero__overlay" aria-hidden="true" />
        <div className="home-hero__content">
          <img className="home-hero__seal" src={lnhsLogo} alt="Looc National High School seal" />
          <p className="home-hero__eyebrow">Looc National High School</p>
          <h1 id="home-title">Attendance Monitoring System</h1>
          <p className="home-hero__description">
            A QR-based attendance monitoring system with automatic parent SMS notifications. Students scan their QR ID at four daily checkpoints while the system records attendance status and notifies parents or guardians.
          </p>
          <div className="home-actions">
            <Button className="home-actions__primary" variant="primary" onClick={() => navigate('/login')}>
              <LogIn size={16} aria-hidden="true" /> Sign In
            </Button>
            <Button className="home-actions__secondary" variant="outline" onClick={() => navigate('/about')}>
              <Info size={16} aria-hidden="true" /> About the System
            </Button>
          </div>
        </div>
      </section>

      <section className="home-features" aria-labelledby="home-features-title">
        <div className="home-features__heading">
          <span aria-hidden="true" />
          <h2 id="home-features-title">System Features</h2>
          <span aria-hidden="true" />
        </div>
        <div className="home-features__grid">
          {features.map(({ icon: Icon, title, description }) => (
            <article className="home-feature" key={title}>
              <Icon className="home-feature__icon" size={24} aria-hidden="true" />
              <div className="home-feature__copy">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer__identity">
          <span className="home-footer__accent" aria-hidden="true" />
          <span>Looc National High School</span>
          <span className="home-footer__divider" aria-hidden="true" />
          <span>Attendance Monitoring System</span>
        </div>
        <span className="home-footer__version">v2.0 · © {new Date().getFullYear()} LNHS</span>
      </footer>
    </main>
  );
}