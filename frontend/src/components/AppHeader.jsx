import { Link, NavLink } from 'react-router-dom';

export default function AppHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="BMTC Digital Ticketing home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-copy">
            <strong>BMTC</strong>
            <span>Digital ticketing</span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/routes">Routes</NavLink>
          <NavLink to="/passenger">Passengers</NavLink>
          <NavLink to="/conductor">Conductors</NavLink>
        </nav>

        <Link className="header-cta" to="/passenger">
          Get started <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
