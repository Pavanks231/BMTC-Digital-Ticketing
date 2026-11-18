import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="portal-page page-width">
      <div className="portal-card not-found-card">
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1>Looks like this<br /><span>bus has moved.</span></h1>
        <p className="portal-description">That address does not match a page in this demo.</p>
        <Link className="button button-primary" to="/">Return home <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
