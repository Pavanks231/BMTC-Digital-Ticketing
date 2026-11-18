import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../services/api.js';
import './TransitPage.css';

function formatTime(value) {
  return value ? value.slice(0, 5) : '—';
}

export default function TransitPage() {
  const [search, setSearch] = useState('');
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selection, setSelection] = useState({ routeCode: '', direction: '' });
  const [routeDetail, setRouteDetail] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busError, setBusError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/transit/buses')
      .then(async ({ data }) => {
        const busesWithQr = await Promise.all(data.buses.map(async (bus) => ({
          ...bus,
          qrDataUrl: await QRCode.toDataURL(bus.staticQrValue, {
            errorCorrectionLevel: 'Q',
            margin: 1,
            width: 160,
            color: { dark: '#173c30', light: '#ffffff' },
          }),
        })));
        if (!cancelled) setBuses(busesWithQr);
      })
      .catch((error) => {
        if (!cancelled) setBusError(error.response?.data?.message || 'Could not load the bus register.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      setCatalogError('');
      try {
        const { data } = await api.get('/transit/routes', {
          params: search.trim() ? { q: search.trim() } : {},
          signal: controller.signal,
        });
        setRoutes(data.routes);
        setSelection((current) => {
          const selectedRoute = data.routes.find((route) => route.routeCode === current.routeCode) || data.routes[0];
          if (!selectedRoute) return { routeCode: '', direction: '' };
          const hasCurrentDirection = selectedRoute.directions.some((item) => item.name === current.direction);
          return {
            routeCode: selectedRoute.routeCode,
            direction: hasCurrentDirection ? current.direction : selectedRoute.directions[0]?.name || '',
          };
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setRoutes([]);
          setCatalogError(error.response?.data?.message || 'Could not load routes. Check the backend and MySQL connection.');
        }
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    if (!selection.routeCode || !selection.direction) {
      setRouteDetail(null);
      return undefined;
    }

    const controller = new AbortController();
    async function loadDirection() {
      setDetailLoading(true);
      setDetailError('');
      try {
        const routeCode = encodeURIComponent(selection.routeCode);
        const direction = encodeURIComponent(selection.direction);
        const { data } = await api.get(`/transit/routes/${routeCode}/directions/${direction}`, {
          signal: controller.signal,
        });
        setRouteDetail(data.route);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRouteDetail(null);
          setDetailError(error.response?.data?.message || 'Could not load this route direction.');
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }
    loadDirection();
    return () => controller.abort();
  }, [selection]);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.routeCode === selection.routeCode) || null,
    [routes, selection.routeCode],
  );

  function chooseRoute(route) {
    setSelection({ routeCode: route.routeCode, direction: route.directions[0]?.name || '' });
  }

  return (
    <section className="transit-page page-width">
      <Link className="back-link" to="/">← Back to home</Link>

      <header className="transit-heading">
        <div>
          <p className="eyebrow">BUS · ROUTE · STOP REGISTER · PHASE 4</p>
          <h1>Know the route<br /><span>before the ride.</span></h1>
          <p className="transit-intro">Search the imported route list, check directions, and follow each stop in sequence.</p>
        </div>
        <div className="transit-data-badge">
          <strong>200</strong>
          <span>sample routes<br />from your workbook</span>
        </div>
      </header>

      <section className="bus-register" aria-labelledby="bus-register-title">
        <div className="transit-section-heading">
          <div>
            <p className="eyebrow">FLEET</p>
            <h2 id="bus-register-title">Bus register</h2>
          </div>
          <span>{buses.length} active {buses.length === 1 ? 'bus' : 'buses'}</span>
        </div>
        {busError ? <p className="transit-error" role="alert">{busError}</p> : buses.length ? (
          <div className="bus-register-grid">
            {buses.map((bus) => (
              <article className="bus-register-card" key={bus.id}>
                <span className="bus-symbol" aria-hidden="true">B</span>
                <div className="bus-register-main">
                  <span className={`bus-state ${bus.status}`}><i />{bus.status === 'running' ? 'In service' : 'Available'}</span>
                  <h3>{bus.registrationNumber}</h3>
                  {bus.trip ? (
                    <p>Trip {bus.trip.code} · Route {bus.trip.routeCode} {bus.trip.direction}<br /><span>Current stop: {bus.trip.currentStop || 'Not set'}</span></p>
                  ) : <p>No running trip assigned</p>}
                </div>
                <div className="bus-static-qr">
                  <img src={bus.qrDataUrl} alt={`Static bus QR code for ${bus.registrationNumber}`} />
                  <span>STATIC BUS QR</span>
                  <a href={bus.qrDataUrl} download={`${bus.registrationNumber}-bus-qr.png`}>Download</a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="transit-empty-inline">{catalogLoading ? 'Loading bus register…' : 'No active buses are currently listed.'}</p>
        )}
      </section>

      <section className="route-management" aria-labelledby="route-management-title">
        <div className="transit-section-heading route-management-heading">
          <div>
            <p className="eyebrow">ROUTES & STOPS</p>
            <h2 id="route-management-title">Route directory</h2>
          </div>
          <label className="route-search">
            <span className="sr-only">Search by route, name, or stop</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search route, name, or stop"
              maxLength={80}
            />
          </label>
        </div>

        {catalogError && <p className="transit-error" role="alert">{catalogError}</p>}
        <div className="route-browser">
          <aside className="route-results" aria-label="Matching routes" aria-busy={catalogLoading}>
            <div className="route-results-heading">
              <strong>{catalogLoading ? 'Searching…' : `${routes.length} ${routes.length === 1 ? 'route' : 'routes'}`}</strong>
              <span>Choose a route</span>
            </div>
            {routes.map((route) => (
              <button
                className={`route-result ${selection.routeCode === route.routeCode ? 'selected' : ''}`}
                type="button"
                key={route.routeCode}
                aria-pressed={selection.routeCode === route.routeCode}
                onClick={() => chooseRoute(route)}
              >
                <span className="route-result-code">{route.routeCode}</span>
                <span className="route-result-copy">
                  <strong>{route.routeName}</strong>
                  <small>{route.directions.length} {route.directions.length === 1 ? 'direction' : 'directions'} · {route.directions.reduce((sum, item) => sum + item.stopCount, 0)} listed stop entries</small>
                </span>
                <span className="route-result-arrow" aria-hidden="true">›</span>
              </button>
            ))}
            {!catalogLoading && !catalogError && routes.length === 0 && (
              <p className="route-no-results">No routes or stops match “{search}”. Try another search.</p>
            )}
          </aside>

          <article className="route-detail" aria-live="polite" aria-busy={detailLoading}>
            {detailError && <p className="transit-error" role="alert">{detailError}</p>}
            {detailLoading ? <p className="transit-empty-inline">Loading route details…</p> : routeDetail ? (
              <>
                <div className="route-detail-topline">
                  <span className="route-detail-kicker">ROUTE {routeDetail.routeCode}</span>
                  <span className="route-source">{routeDetail.source === 'provided_workbook' ? 'Workbook data' : 'Local data'}</span>
                </div>
                <div className="route-detail-title">
                  <div>
                    <h2>{routeDetail.routeName}</h2>
                    <p>{routeDetail.description}</p>
                  </div>
                  <label className="direction-select-label">
                    <span>Direction</span>
                    <select
                      value={selection.direction}
                      onChange={(event) => setSelection((current) => ({ ...current, direction: event.target.value }))}
                    >
                      {selectedRoute?.directions.map((direction) => (
                        <option key={direction.name} value={direction.name}>{direction.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="route-facts">
                  <div><span>Listed stops</span><strong>{routeDetail.stops.length}</strong></div>
                  <div><span>Trips in source</span><strong>{routeDetail.scheduledTrips}</strong></div>
                  <div><span>First / last</span><strong>{formatTime(routeDetail.firstTrip)} / {formatTime(routeDetail.lastTrip)}</strong></div>
                </div>

                <div className="stop-sequence-heading">
                  <div><p className="eyebrow">ORDERED STOPS</p><h3>Journey sequence</h3></div>
                  <span>Boarding order</span>
                </div>
                <ol className="catalog-stop-list">
                  {routeDetail.stops.map((stop) => (
                    <li key={stop.sequence}>
                      <span className="catalog-stop-number">{String(stop.sequence).padStart(2, '0')}</span>
                      <span className="catalog-stop-name">{stop.name}</span>
                      {stop.distanceFromPreviousKm !== null && (
                        <small>{stop.distanceFromPreviousKm} km</small>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="distance-note">Stop distances are shown only when the source data provides them. Route order is preserved from the supplied workbook.</p>
              </>
            ) : !catalogLoading && !routes.length ? (
              <div className="route-detail-placeholder"><span className="route-placeholder-icon">⌕</span><h2>No route selected</h2><p>Try a different route name, code, or stop.</p></div>
            ) : (
              <p className="transit-empty-inline">Choose a route to see its directions and stops.</p>
            )}
          </article>
        </div>
      </section>
    </section>
  );
}
