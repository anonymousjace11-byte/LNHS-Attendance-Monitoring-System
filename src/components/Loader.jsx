import './Loader.css';
import schoolPhoto from '../imports/lnhs-banner.png';
import teamSeal from '../imports/TEAM SEAL.png';
import walkingStudentGif from '../imports/walking-student.gif';

export default function Loader({ exiting = false }) {
  return (
    <div
      className={`app-loader${exiting ? ' app-loader--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Entering Looc National High School campus"
    >
      <img className="app-loader__photo" src={schoolPhoto} alt="" aria-hidden="true" />
      <div className="app-loader__shade" aria-hidden="true" />
      <div className="app-loader__vignette" aria-hidden="true" />
      <div className="app-loader__spotlight" aria-hidden="true" />

      <img className="app-loader__seal" src={teamSeal} alt="" aria-hidden="true" />

      <div className="app-loader__road" aria-hidden="true">
        <span />
      </div>

      <img
        className="loader-student-gif"
        src={walkingStudentGif}
        alt=""
        aria-hidden="true"
      />

      <div className="app-loader__caption">
        <p className="app-loader__name">LNHS ATTENDSYNC</p>
        <p className="app-loader__status">Preparing secure session...</p>
      </div>

      <div className="app-loader__progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}