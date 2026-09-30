import { Info, ShieldCheck } from 'lucide-react';

const details = [
  ['System name', 'LNHS Attendance Monitoring System with Auto Messaging Using QR Code'],
  ['Institution', 'Looc National High School (Senior High School), Looc, Romblon, Philippines'],
  ['Purpose', 'Replace manual roll call with QR attendance and parent or guardian SMS notifications.'],
  ['Attendance policy', 'Four scans per school day: AM-1, AM-2, PM-1, and PM-2. One scan is accepted per student in each period.'],
  ['Time rule', 'AM-1 scans at or before 7:30 AM are On-Time. Later AM-1 scans are Late.'],
  ['Access roles', 'Administrators have full access. Teachers are limited to their assigned sections. Students scan; parents and guardians receive notifications.'],
  ['Scanner input', 'USB QR readers using keyboard-wedge (HID) input are supported. The browser-reported device name does not verify the reader brand.'],
];

export default function About() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">About</h1>
          <p className="page-sub">System information</p>
        </div>
      </div>

      <section className="card about-panel">
        <div className="card-header"><span className="card-title"><Info size={15} /> LNHS Attendance Monitoring System</span></div>
        <dl className="about-details">
          {details.map(([label, value]) => (
            <div className="about-details__row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card about-panel">
        <div className="card-header"><span className="card-title"><ShieldCheck size={15} /> Data Privacy</span></div>
        <p className="about-privacy">
          The system handles student and parent or guardian information under the Data Privacy Act of 2012 (Republic Act No. 10173). Access is limited to authorized school personnel. Data access, correction, or deletion requests may be directed to the school registrar.
        </p>
      </section>
    </div>
  );
}