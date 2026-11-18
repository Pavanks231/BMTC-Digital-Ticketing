import { Link } from 'react-router-dom';

export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Link className="footer-brand" to="/">BMTC <span>Digital ticketing</span></Link>
        <p>Designed to make every Bengaluru bus ride a little simpler.</p>
        <span className="footer-note">College mini project · Demo experience</span>
      </div>
    </footer>
  );
}
