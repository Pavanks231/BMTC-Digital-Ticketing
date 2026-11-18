import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import './ConductorPage.css';
import TicketQrCode from '../components/TicketQrCode.jsx';

const TicketQrScanner = lazy(() => import('../components/TicketQrScanner.jsx'));
const StudentPassQrScanner = lazy(() => import('../components/StudentPassQrScanner.jsx'));

function firstTripDestination(trip) {
  if (!trip || trip.currentStopSequence === null) return '';
  const nextStop = trip.stops.find((stop) => stop.sequence > trip.currentStopSequence);
  return nextStop ? String(nextStop.sequence) : '';
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function serviceError(error) {
  return error.response?.data?.message
    || 'Could not connect to the ticketing service. Make sure the backend and MySQL are running.';
}

export default function ConductorPage() {
  const [dashboard, setDashboard] = useState(null);
  const [selectedStopSequence, setSelectedStopSequence] = useState('');
  const [email, setEmail] = useState('conductor@example.test');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [busy, setBusy] = useState(false);
  const [updatingStop, setUpdatingStop] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [verificationHistoryLoading, setVerificationHistoryLoading] = useState(false);
  const [verificationHistoryError, setVerificationHistoryError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState('');
  const [verifyingTicket, setVerifyingTicket] = useState(false);
  const [assistedDestinationSequence, setAssistedDestinationSequence] = useState('');
  const [assistedBookingBusy, setAssistedBookingBusy] = useState(false);
  const [assistedBookingError, setAssistedBookingError] = useState('');
  const [assistedTicket, setAssistedTicket] = useState(null);

  useEffect(() => {
    api.get('/conductor/dashboard')
      .then(({ data }) => {
        setDashboard(data);
        setSelectedStopSequence(data.trip?.currentStopSequence ? String(data.trip.currentStopSequence) : '');
        setAssistedDestinationSequence(firstTripDestination(data.trip));
      })
      .catch((error) => {
        if (error.response?.status !== 401) setMessage(serviceError(error));
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!dashboard?.conductor.id) {
      setVerificationHistory([]);
      setVerificationHistoryLoading(false);
      setVerificationHistoryError('');
      return undefined;
    }

    let current = true;
    setVerificationHistoryLoading(true);
    setVerificationHistoryError('');
    api.get('/conductor/tickets/verification-history')
      .then(({ data }) => { if (current) setVerificationHistory(data.verifications); })
      .catch((error) => {
        if (current) setVerificationHistoryError(serviceError(error));
      })
      .finally(() => { if (current) setVerificationHistoryLoading(false); });
    return () => { current = false; };
  }, [dashboard?.conductor.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setMessageType('error');

    try {
      await api.post('/conductor/auth/login', { email, password });
      const { data } = await api.get('/conductor/dashboard');
      setDashboard(data);
      setSelectedStopSequence(data.trip?.currentStopSequence ? String(data.trip.currentStopSequence) : '');
      setAssistedDestinationSequence(firstTripDestination(data.trip));
      setPassword('');
    } catch (error) {
      setMessage(serviceError(error));
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleCurrentStopUpdate(event) {
    event.preventDefault();
    if (!dashboard?.trip || !selectedStopSequence) return;

    setUpdatingStop(true);
    setMessage('');
    setMessageType('error');
    try {
      const { data } = await api.patch('/conductor/trips/current-stop', {
        sequenceNumber: Number(selectedStopSequence),
      });
      setDashboard(data.dashboard);
      setSelectedStopSequence(String(data.dashboard.trip.currentStopSequence));
      setAssistedDestinationSequence(firstTripDestination(data.dashboard.trip));
      setAssistedTicket(null);
      setMessage(data.message || 'Current stop updated.');
      setMessageType('success');
    } catch (error) {
      setMessage(serviceError(error));
      setMessageType('error');
    } finally {
      setUpdatingStop(false);
    }
  }

  async function handleTicketScanned(publicId) {
    setVerifyingTicket(true);
    setVerificationResult(null);
    setVerificationError('');
    try {
      const { data } = await api.post('/conductor/tickets/verify', { publicId });
      setVerificationResult(data.verification);
      try {
        const history = await api.get('/conductor/tickets/verification-history');
        setVerificationHistory(history.data.verifications);
        setVerificationHistoryError('');
      } catch (error) {
        setVerificationHistoryError(serviceError(error));
      }
    } catch (error) {
      setVerificationError(serviceError(error));
    } finally {
      setVerifyingTicket(false);
    }
  }

  async function handleStudentPassScanned(studentPassPublicId) {
    if (!assistedDestinationSequence) return;
    setAssistedBookingBusy(true);
    setAssistedBookingError('');
    setAssistedTicket(null);
    try {
      const { data } = await api.post('/conductor/tickets/assisted', {
        studentPassPublicId,
        destinationStopSequence: Number(assistedDestinationSequence),
      });
      setAssistedTicket(data.ticket);
    } catch (error) {
      setAssistedBookingError(serviceError(error));
    } finally {
      setAssistedBookingBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await api.post('/conductor/auth/logout');
      setDashboard(null);
      setSelectedStopSequence('');
      setVerificationResult(null);
      setAssistedTicket(null);
      setMessage('You have signed out.');
      setMessageType('success');
    } catch (error) {
      setMessage(serviceError(error));
      setMessageType('error');
    }
  }

  return (
    <section className="portal-page page-width conductor-page">
      <Link className="back-link" to="/">← Back to home</Link>

      {checkingSession ? (
        <div className="portal-card auth-card" role="status">
          <p className="eyebrow">CONDUCTOR PORTAL · PHASE 3</p>
          <p className="portal-description">Checking your sign-in…</p>
        </div>
      ) : dashboard ? (
        <section className="conductor-dashboard" aria-labelledby="dashboard-title">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">CONDUCTOR PORTAL · PHASE 9</p>
              <h1 id="dashboard-title">Your trip,<br /><span>at a glance.</span></h1>
              <p className="portal-description">Welcome, {dashboard.conductor.fullName}. Manage your current stop and verify tickets for the assigned trip.</p>
            </div>
            <button className="button button-secondary dashboard-signout" type="button" onClick={handleSignOut}>Sign out</button>
          </div>

          {message && <p className={`auth-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}

          {dashboard.trip ? (
            <div className="trip-layout">
              <article className="trip-summary">
                <div className="trip-summary-top">
                  <span className="trip-status"><i /> Trip in progress</span>
                  <span className="trip-code">{dashboard.trip.code}</span>
                </div>
                <p className="eyebrow">ASSIGNED BUS</p>
                <h2>{dashboard.trip.busRegistrationNumber}</h2>
                <div className="trip-route-title">
                  <span>Route {dashboard.trip.routeCode}</span>
                  <strong>{dashboard.trip.routeName} · {dashboard.trip.direction}</strong>
                  <small>{dashboard.trip.description}</small>
                </div>
                <div className="current-stop-panel">
                  <span>Current stop</span>
                  <strong>{dashboard.trip.currentStop || 'Not set'}</strong>
                  <small>Stop {dashboard.trip.currentStopSequence} of {dashboard.trip.stops.length}</small>
                  {dashboard.trip.currentStopUpdatedAt && <small>Last updated {new Date(dashboard.trip.currentStopUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}
                </div>
                <form className="stop-update-form" onSubmit={handleCurrentStopUpdate}>
                  <label htmlFor="current-stop-sequence">Set the current bus stop
                    <select
                      id="current-stop-sequence"
                      value={selectedStopSequence}
                      onChange={(event) => setSelectedStopSequence(event.target.value)}
                      required
                    >
                      {dashboard.trip.stops.map((stop) => (
                        <option key={stop.sequence} value={stop.sequence}>Stop {stop.sequence}: {stop.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button-primary stop-update-button"
                    type="submit"
                    disabled={updatingStop || !selectedStopSequence || Number(selectedStopSequence) === dashboard.trip.currentStopSequence}
                  >
                    {updatingStop ? 'Updating stop…' : 'Update current stop'}
                  </button>
                  <p className="dashboard-note">Passengers scanning this bus’s static QR will see the updated boarding stop.</p>
                </form>
              </article>

              <article className="stop-list-card">
                <div className="stop-list-heading">
                  <div>
                    <p className="eyebrow">ROUTE STOPS</p>
                    <h2>Journey sequence</h2>
                  </div>
                  <span>{dashboard.trip.stops.length} stops</span>
                </div>
                <ol className="journey-stops">
                  {dashboard.trip.stops.map((stop) => (
                    <li className={stop.isCurrent ? 'current' : ''} key={stop.sequence}>
                      <span className="journey-marker" aria-hidden="true">{stop.isCurrent ? '●' : ''}</span>
                      <span className="journey-stop-name">{stop.name}</span>
                      {stop.isCurrent && <span className="current-label">CURRENT</span>}
                    </li>
                  ))}
                </ol>
              </article>
            </div>
          ) : (
            <article className="trip-empty">
              <span className="portal-icon conductor-icon" aria-hidden="true">C</span>
              <h2>No active trip assigned</h2>
              <p className="portal-description">There is no running bus trip linked to this conductor right now.</p>
            </article>
          )}

          <section className="ticket-verification-panel" aria-labelledby="ticket-verification-title">
            <div className="ticket-verification-heading">
              <div>
                <p className="eyebrow">PHASE 9 · TICKET CHECK</p>
                <h2 id="ticket-verification-title">Verify a passenger ticket</h2>
                <p className="portal-description">Scan the passenger’s QR. Tickets are accepted only for your active trip and can be used once.</p>
              </div>
              {dashboard.trip && <span className="verification-trip-badge">{dashboard.trip.busRegistrationNumber} · {dashboard.trip.code}</span>}
            </div>
            {dashboard.trip ? (
              <Suspense fallback={<p className="auth-hint">Preparing ticket scanner…</p>}>
                <TicketQrScanner onTicketScanned={handleTicketScanned} disabled={verifyingTicket} />
              </Suspense>
            ) : (
              <p className="verification-no-trip">Ticket scanning is disabled because there is no active trip assigned.</p>
            )}
            {verifyingTicket && <p className="auth-message" role="status">Checking ticket against this trip…</p>}
            {verificationError && <p className="auth-message error" role="alert">{verificationError}</p>}
            {verificationResult && (
              <article className={`ticket-verification-result ${verificationResult.accepted ? 'accepted' : 'rejected'}`} role={verificationResult.accepted ? 'status' : 'alert'}>
                <span>{verificationResult.accepted ? 'TICKET ACCEPTED' : 'NOT ACCEPTED'}</span>
                <strong>{verificationResult.message}</strong>
                {verificationResult.ticket && (
                  <div className="verified-ticket-details">
                    <p><b>Ticket</b> {verificationResult.ticket.reference} · <b>Bus</b> {verificationResult.ticket.busRegistrationNumber}</p>
                    <p><b>Route</b> {verificationResult.ticket.routeCode} {verificationResult.ticket.direction} · {verificationResult.ticket.tripCode}</p>
                    <p><b>Journey</b> {verificationResult.ticket.boardingStop} → {verificationResult.ticket.destinationStop}</p>
                    <p><b>Passengers</b> {verificationResult.ticket.passengerCount} · <b>Fare</b> {new Intl.NumberFormat('en-IN', { style: 'currency', currency: verificationResult.ticket.currency }).format(verificationResult.ticket.fareTotal)}</p>
                  </div>
                )}
              </article>
            )}
            <div className="assisted-booking-panel">
              <div className="assisted-booking-heading">
                <div><p className="eyebrow">STUDENT PASS QR</p><h3>Scan and issue student ticket</h3></div>
              </div>
              <p className="assisted-booking-description">Choose the destination, then scan the student’s pass QR. The system checks that it is active and approved for this route, then issues one ticket for the pass holder.</p>
              {dashboard.trip?.currentStopSequence !== null && dashboard.trip?.currentStopSequence !== undefined ? (
                <div className="assisted-booking-form">
                  <label htmlFor="assisted-destination">Destination stop
                    <select
                      id="assisted-destination"
                      value={assistedDestinationSequence}
                      onChange={(event) => { setAssistedDestinationSequence(event.target.value); setAssistedTicket(null); }}
                      required
                    >
                      {dashboard.trip.stops
                        .filter((stop) => stop.sequence > dashboard.trip.currentStopSequence)
                        .map((stop) => <option value={stop.sequence} key={stop.sequence}>Stop {stop.sequence}: {stop.name}</option>)}
                    </select>
                  </label>
                  {assistedBookingError && <p className="auth-message error" role="alert">{assistedBookingError}</p>}
                  <Suspense fallback={<p className="auth-hint">Preparing the student pass scanner…</p>}>
                    <StudentPassQrScanner
                      onPassScanned={handleStudentPassScanned}
                      disabled={assistedBookingBusy || !assistedDestinationSequence}
                    />
                  </Suspense>
                  {assistedBookingBusy && <p className="auth-message" role="status">Verifying route eligibility and issuing the student’s ticket…</p>}
                </div>
              ) : (
                <p className="verification-no-trip">Set a current stop on an active trip before creating an assisted ticket.</p>
              )}
              {assistedTicket && (
                <article className="assisted-ticket-printable" aria-live="polite">
                  <div className="assisted-ticket-heading">
                    <div><p className="eyebrow">STUDENT PASS VERIFIED</p><h4>Assisted ticket {assistedTicket.reference}</h4></div>
                    <span>VALID</span>
                  </div>
                  <div className="assisted-ticket-details">
                    <p><b>Trip</b> {assistedTicket.trip.code} · Bus {dashboard.trip.busRegistrationNumber}</p>
                    <p><b>Journey</b> {assistedTicket.boardingStop.name} → {assistedTicket.destinationStop.name}</p>
                    <p><b>Fare due</b> {formatCurrency(assistedTicket.fare.total, assistedTicket.fare.currency)}</p>
                  </div>
                  <TicketQrCode value={assistedTicket.qrValue} reference={assistedTicket.reference} caption="Download or print this QR for the student." />
                  <button className="button button-secondary print-ticket-button" type="button" onClick={() => window.print()}>Print student ticket</button>
                  <p className="assisted-ticket-print-note">Keep the printed ticket with the student. The QR contains only a random ticket ID and can be validated once.</p>
                </article>
              )}
            </div>
            <div className="verification-history">
              <div className="verification-history-heading">
                <div><p className="eyebrow">AUDIT LOG</p><h3>Ticket verification history</h3></div>
                <span>{verificationHistory.length} recent</span>
              </div>
              {verificationHistoryLoading && <p className="auth-hint" role="status">Loading verification history…</p>}
              {verificationHistoryError && <p className="auth-message error" role="alert">{verificationHistoryError}</p>}
              {!verificationHistoryLoading && verificationHistory.length === 0 ? (
                <p className="verification-history-empty">Scanned ticket attempts for this conductor will appear here.</p>
              ) : (
                <ul className="verification-history-list">
                  {verificationHistory.map((entry, index) => (
                    <li className={`verification-history-entry ${entry.result === 'accepted' ? 'accepted' : ''}`} key={`${entry.reference}-${entry.verifiedAt}-${index}`}>
                      <span className="verification-outcome">{entry.result.replaceAll('_', ' ')}</span>
                      <span className="verification-entry-detail"><b>{entry.reference}</b>{entry.routeCode ? ` · Route ${entry.routeCode} ${entry.direction}` : ''}{entry.boardingStop && entry.destinationStop ? ` · ${entry.boardingStop} to ${entry.destinationStop}` : ''}</span>
                      <time>{new Date(entry.verifiedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </section>
      ) : (
        <div className="portal-card auth-card">
          <span className="portal-icon conductor-icon" aria-hidden="true">C</span>
          <p className="eyebrow">CONDUCTOR PORTAL · PHASE 3</p>
          <h1>Welcome<br /><span>aboard.</span></h1>
          <p className="portal-description">Sign in to view the bus and route assigned to your demo account.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="conductor-email">
              Email address
              <input id="conductor-email" name="email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label htmlFor="conductor-password">
              Password
              <input id="conductor-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <p className="auth-hint">Demo account: conductor@example.test. Use DEMO_CONDUCTOR_PASSWORD from backend/.env; if unset, it uses the student demo password.</p>
            {message && <p className={`auth-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Sign in'} {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
