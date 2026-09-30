import { useEffect, useState, useRef } from 'react';
import { Activity, Bot, CircleHelp, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

function getLocalReply(prompt, { online, hasDataError }) {
  const text = prompt.trim().toLowerCase();
  if (!text) return 'Ask about attendance, data health, security checks, or how to use this system.';
  if (text.includes('security') || text.includes('attack') || text.includes('malicious')) {
    return 'Security controls are server-enforced: Firebase token verification, role checks, section access checks, signed QR validation, CORS validation, and rate limits. Review Audit Logs for investigation; no automatic destructive action is taken.';
  }
  if (text.includes('data') || text.includes('database') || text.includes('error')) {
    return hasDataError ? 'The data layer reports an error. Check the API health endpoint, Firebase connectivity, and the browser console before retrying.' : 'The data layer currently reports no application error. Live records come from Firebase and the staff API.';
  }
  if (text.includes('offline') || text.includes('online')) {
    return online ? 'The browser reports online connectivity. Firebase and the staff API still require valid configuration and authentication.' : 'The browser is offline. The companion is using its local fallback and cannot verify live records.';
  }
  if (text.includes('attendance') || text.includes('qr')) {
    return 'Use QR Scanner for signed student credentials. The server decides Present or Late using the configured Asia/Manila cutoff.';
  }
  return 'I can provide local guidance and diagnostics. For live external knowledge, connect an approved AI provider through a reviewed backend integration.';
}

export default function SystemCompanion() {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState('');
  const wrapRef = useRef(null);
  const { user } = useAuth();
  const { error: dataError } = useData();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onEsc = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const ask = (event) => {
    event.preventDefault();
    setReply(getLocalReply(prompt, { online, hasDataError: Boolean(dataError) }));
  };

  return (
    <div className="companion-entry" ref={wrapRef}>
      <button
        className="companion-orb"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="System Companion"
        title="System Companion"
      >
        <span className="companion-orb__core"><Bot size={12} /></span>
        <span className={`companion-orb__pulse ${online ? 'is-online' : 'is-offline'}`} />
      </button>
      {open && (
        <section className="companion-panel" aria-label="System Companion">
          <header className="companion-panel__header">
            <div className="companion-panel__title">
              <span className="companion-orb companion-orb--inline">
                <span className="companion-orb__core"><Bot size={14} /></span>
              </span>
              <div>
                <strong>System Companion</strong>
                <small>{online ? 'Online · local fallback' : 'Offline · local mode'}</small>
              </div>
            </div>
            <button type="button" className="companion-close" onClick={() => setOpen(false)} aria-label="Close companion"><X size={16} /></button>
          </header>
          <div className="companion-panel__body">
            <div className="companion-health-grid">
              <span><Activity size={12} /> App <b>Ready</b></span>
              <span>{online ? <Wifi size={12} /> : <WifiOff size={12} />} Net <b>{online ? 'Online' : 'Offline'}</b></span>
              <span><ShieldCheck size={12} /> Auth <b>{user ? 'Verified' : 'Waiting'}</b></span>
              <span><CircleHelp size={12} /> Data <b>{dataError ? 'Check' : 'Healthy'}</b></span>
            </div>
            {reply && <p className="companion-reply">{reply}</p>}
            <form className="companion-form" onSubmit={ask}>
              <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about this system..." aria-label="Ask the system companion" />
              <button type="submit">Ask</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}