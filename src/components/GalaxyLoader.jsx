import { useEffect } from 'react';
import './GalaxyLoader.css';

export default function GalaxyLoader({ onComplete }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 2000);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="galaxy-loader" role="status" aria-live="polite" aria-label="Loading attendance system">
      <div className="galaxy-loader__orbit"><span /><span /><span /></div>
      <div className="galaxy-loader__core">LNHS</div>
      <div className="galaxy-loader__title">Loading attendance system</div>
      <div className="galaxy-loader__track"><span /></div>
    </div>
  );
}