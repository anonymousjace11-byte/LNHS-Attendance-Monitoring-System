import bannerPhoto from '../imports/lnhs-banner.png';

export default function PageCover({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-cover">
      <div className="page-cover__bg" style={{ backgroundImage: `url(${bannerPhoto})` }} aria-hidden="true" />
      <div className="page-cover__overlay" aria-hidden="true" />
      <div className="page-cover__accent page-cover__accent--top-right" aria-hidden="true" />
      <div className="page-cover__accent page-cover__accent--bottom-left" aria-hidden="true" />
      <div className="page-cover__content">
        <div className="page-cover__text">
          {eyebrow && <div className="page-cover__eyebrow">{eyebrow}</div>}
          <h1 className="page-cover__title">{title}</h1>
          {subtitle && <p className="page-cover__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-cover__actions">{actions}</div>}
      </div>
    </header>
  );
}