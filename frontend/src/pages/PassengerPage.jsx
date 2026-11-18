import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import './PassengerPage.css';
import PassengerTicketCard from '../components/PassengerTicketCard.jsx';
import TicketQrCode from '../components/TicketQrCode.jsx';

const BusQrScanner = lazy(() => import('../components/BusQrScanner.jsx'));
const PASSENGER_CATEGORIES = [
  { key: 'general', label: 'Adult / general' },
  { key: 'child', label: 'Child' },
  { key: 'senior_citizen', label: 'Senior citizen' },
  { key: 'student', label: 'Student' },
];

function initialPassengerCounts(passenger) {
  const studentHasPass = Boolean(passenger?.hasValidStudentPass);
  return {
    general: studentHasPass ? '0' : '1',
    child: '0',
    senior_citizen: '0',
    student: studentHasPass ? '1' : '0',
  };
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PassengerPage() {
  const [mode, setMode] = useState('login');
  const [passenger, setPassenger] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error');
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [studentPass, setStudentPass] = useState(null);
  const [studentPassLoading, setStudentPassLoading] = useState(false);
  const [studentPassError, setStudentPassError] = useState('');
  const [boardingInfo, setBoardingInfo] = useState(null);
  const [boardingLoading, setBoardingLoading] = useState(false);
  const [boardingError, setBoardingError] = useState('');
  const [destinationSequence, setDestinationSequence] = useState('');
  const [passengerCounts, setPassengerCounts] = useState(initialPassengerCounts(null));
  const [fareQuote, setFareQuote] = useState(null);
  const [fareQuoteError, setFareQuoteError] = useState('');
  const [fareQuoteLoading, setFareQuoteLoading] = useState(false);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketHistoryLoading, setTicketHistoryLoading] = useState(false);
  const [ticketHistoryError, setTicketHistoryError] = useState('');
  const [ticketIssueLoading, setTicketIssueLoading] = useState(false);
  const [ticketIssueError, setTicketIssueError] = useState('');

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        setPassenger(data.passenger);
        setPassengerCounts(initialPassengerCounts(data.passenger));
      })
      .catch(() => setPassenger(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!passenger?.id) {
      setStudentPass(null);
      setStudentPassLoading(false);
      setStudentPassError('');
      return undefined;
    }

    let current = true;
    setStudentPassLoading(true);
    setStudentPassError('');
    api.get('/student-passes/current')
      .then(({ data }) => { if (current) setStudentPass(data.pass); })
      .catch((error) => {
        if (current) setStudentPassError(error.response?.data?.message || 'Could not load your student pass QR.');
      })
      .finally(() => { if (current) setStudentPassLoading(false); });
    return () => { current = false; };
  }, [passenger?.id]);

  useEffect(() => {
    if (!passenger?.id) {
      setTicketHistory([]);
      setActiveTicket(null);
      setTicketHistoryLoading(false);
      setTicketHistoryError('');
      return undefined;
    }

    let current = true;
    setTicketHistoryLoading(true);
    setTicketHistoryError('');
    api.get('/tickets')
      .then(({ data }) => {
        if (!current) return;
        setTicketHistory(data.tickets);
        setActiveTicket((selected) => data.tickets.find((ticket) => ticket.publicId === selected?.publicId) || data.tickets[0] || null);
      })
      .catch((error) => {
        if (current) setTicketHistoryError(error.response?.data?.message || 'Could not load your ticket history.');
      })
      .finally(() => { if (current) setTicketHistoryLoading(false); });
    return () => { current = false; };
  }, [passenger?.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload = mode === 'register' ? { fullName, email, password } : { email, password };
      const { data } = await api.post(endpoint, payload);
      setPassenger(data.passenger);
      setPassengerCounts(initialPassengerCounts(data.passenger));
      setPassword('');
      setMessage(mode === 'register' ? 'Your passenger account is ready.' : 'You are signed in.');
      setMessageType('success');
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Could not connect to the ticketing service. Make sure the backend and MySQL are running.',
      );
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await api.post('/auth/logout');
      setPassenger(null);
      setStudentPass(null);
      setBoardingInfo(null);
      setFareQuote(null);
      setDestinationSequence('');
      setTicketHistory([]);
      setActiveTicket(null);
      setMode('login');
      setMessage('You have signed out.');
      setMessageType('success');
    } catch {
      setMessage('Could not reach the ticketing service to sign out.');
      setMessageType('error');
    }
  }

  async function handleBusScanned(registrationNumber) {
    setBoardingInfo(null);
    setBoardingError('');
    setFareQuote(null);
    setFareQuoteError('');
    setDestinationSequence('');
    setBoardingLoading(true);
    try {
      const { data } = await api.get(`/transit/buses/${encodeURIComponent(registrationNumber)}/boarding`);
      setBoardingInfo(data);
      setDestinationSequence(data.trip?.destinations?.[0] ? String(data.trip.destinations[0].sequence) : '');
    } catch (error) {
      if (error.response?.status === 409 && error.response.data.bus) {
        setBoardingInfo({ bus: error.response.data.bus, trip: null });
      } else {
        setBoardingError(error.response?.data?.message || 'Could not look up this bus. Check your connection and try again.');
      }
    } finally {
      setBoardingLoading(false);
    }
  }

  async function handleFareQuote(event) {
    event.preventDefault();
    if (!boardingInfo?.trip || !destinationSequence) return;

    const counts = PASSENGER_CATEGORIES
      .map(({ key }) => ({ category: key, count: Number(passengerCounts[key]) }))
      .filter((item) => item.count > 0);
    setFareQuote(null);
    setFareQuoteError('');
    setFareQuoteLoading(true);
    try {
      const { data } = await api.post(
        `/transit/buses/${encodeURIComponent(boardingInfo.bus.registrationNumber)}/fare-quote`,
        { destinationStopSequence: Number(destinationSequence), passengerCounts: counts },
      );
      setFareQuote(data.quote);
    } catch (error) {
      setFareQuoteError(error.response?.data?.message || 'Could not calculate a fare estimate. Please try again.');
    } finally {
      setFareQuoteLoading(false);
    }
  }

  async function handleIssueTicket() {
    if (!boardingInfo?.trip || !destinationSequence) return;
    const counts = PASSENGER_CATEGORIES
      .map(({ key }) => ({ category: key, count: Number(passengerCounts[key]) }))
      .filter((item) => item.count > 0);

    setTicketIssueLoading(true);
    setTicketIssueError('');
    try {
      const { data } = await api.post('/tickets', {
        registrationNumber: boardingInfo.bus.registrationNumber,
        destinationStopSequence: Number(destinationSequence),
        passengerCounts: counts,
      });
      setActiveTicket(data.ticket);
      setTicketHistory((current) => [data.ticket, ...current.filter((ticket) => ticket.publicId !== data.ticket.publicId)].slice(0, 50));
    } catch (error) {
      setTicketIssueError(error.response?.data?.message || 'Could not create the ticket. Please request a new fare estimate and try again.');
    } finally {
      setTicketIssueLoading(false);
    }
  }

  return (
    <section className="portal-page page-width">
      <Link className="back-link" to="/">← Back to home</Link>
      <div className="portal-card auth-card">
        <span className="portal-icon passenger-icon" aria-hidden="true">P</span>
        <p className="eyebrow">PASSENGER PORTAL · PHASE 8</p>

        {checkingSession ? (
          <p className="portal-description" role="status">Checking your sign-in…</p>
        ) : passenger ? (
          <div className="signed-in-view">
            <h1>Welcome,<br /><span>{passenger.fullName.split(' ')[0]}.</span></h1>
            <p className="portal-description">You’re signed in as {passenger.email}. Scan the bus QR, choose a destination, and get a fare estimate.</p>
            <div className="coming-next">
              <span className={passenger.hasValidStudentPass ? 'coming-dot pass-verified' : 'coming-dot'} />
              <span>
                <strong>{passenger.hasValidStudentPass ? 'Student pass verified' : 'No verified student pass linked'}</strong>
                <small>Pass status is checked by the backend.</small>
              </span>
            </div>
            {studentPassLoading && <p className="auth-hint" role="status">Loading your student pass QR…</p>}
            {studentPassError && <p className="auth-message error" role="alert">{studentPassError}</p>}
            {studentPass && (
              <section className="student-pass-panel" aria-labelledby="student-pass-title">
                <div>
                  <p className="eyebrow">DIGITAL STUDENT PASS</p>
                  <h2 id="student-pass-title">Show this QR to the conductor</h2>
                  <p className="student-pass-route">Valid on route {studentPass.routeCode}</p>
                  <p className="student-pass-validity">{studentPass.routeName} · Valid until {new Date(studentPass.validUntil).toLocaleDateString('en-IN')}</p>
                </div>
                <TicketQrCode
                  value={studentPass.qrValue}
                  reference={studentPass.passNumber}
                  purpose="student-pass"
                  caption="The conductor scans this pass to check its validity and route."
                />
              </section>
            )}
            {!studentPassLoading && !studentPass && !studentPassError && passenger.hasValidStudentPass && (
              <p className="auth-message error" role="status">Your verified pass is missing a route assignment. Contact the administrator.</p>
            )}
            <section className="boarding-panel" aria-labelledby="boarding-title">
              <p className="eyebrow">STATIC BUS QR</p>
              <h2 id="boarding-title">Identify your bus</h2>
              <p className="boarding-description">Scan the code displayed inside the bus. We’ll confirm the bus, route, and current boarding stop.</p>
              <Suspense fallback={<p className="auth-hint">Preparing the QR scanner…</p>}>
                <BusQrScanner onBusScanned={handleBusScanned} />
              </Suspense>
              {boardingLoading && <p className="auth-message" role="status">Checking the bus and active journey…</p>}
              {boardingError && <p className="auth-message error" role="alert">{boardingError}</p>}
              {boardingInfo?.trip ? (
                <article className="boarding-result">
                  <div className="boarding-result-status"><i /> Active trip found</div>
                  <div className="boarding-result-bus">
                    <span>BUS</span><strong>{boardingInfo.bus.registrationNumber}</strong>
                  </div>
                  <div className="boarding-result-route">
                    <span>ROUTE {boardingInfo.trip.routeCode} · {boardingInfo.trip.direction}</span>
                    <strong>{boardingInfo.trip.routeName}</strong>
                    <small>{boardingInfo.trip.description}</small>
                  </div>
                  <div className="boarding-stop">
                    <span>BOARDING STOP</span>
                    <strong>{boardingInfo.trip.boardingStop || 'Awaiting conductor stop update'}</strong>
                    {boardingInfo.trip.boardingStopSequence !== null && <small>Stop {boardingInfo.trip.boardingStopSequence}</small>}
                  </div>
                  {boardingInfo.trip.destinations?.length > 0 ? (
                    <form className="fare-estimate-panel" onSubmit={handleFareQuote}>
                      <div>
                        <p className="eyebrow">PHASE 7 · FARE ESTIMATE</p>
                        <h3>Choose your destination</h3>
                        <p className="fare-estimate-description">The server calculates the estimate from this trip, its current stop, the fare chart, and your verified pass status.</p>
                      </div>
                      <label className="fare-destination-field" htmlFor="fare-destination">
                        Destination stop
                        <select
                          id="fare-destination"
                          value={destinationSequence}
                          onChange={(event) => { setDestinationSequence(event.target.value); setFareQuote(null); }}
                          required
                        >
                          {boardingInfo.trip.destinations.map((stop) => (
                            <option value={stop.sequence} key={stop.sequence}>Stop {stop.sequence}: {stop.name}</option>
                          ))}
                        </select>
                      </label>
                      <fieldset className="fare-passenger-counts">
                        <legend>Passengers in each category</legend>
                        {PASSENGER_CATEGORIES.map(({ key, label }) => (
                          <label className="fare-count-row" htmlFor={`fare-count-${key}`} key={key}>
                            <span>{label}</span>
                            <input
                              id={`fare-count-${key}`}
                              type="number"
                              min="0"
                              max="50"
                              step="1"
                              inputMode="numeric"
                              value={passengerCounts[key]}
                              onChange={(event) => {
                                setPassengerCounts((counts) => ({ ...counts, [key]: event.target.value }));
                                setFareQuote(null);
                              }}
                              aria-label={`${label} passenger count`}
                            />
                          </label>
                        ))}
                      </fieldset>
                      <p className="fare-pass-note">
                        {passenger.hasValidStudentPass
                          ? 'Your verified pass can cover one student in this estimate. Additional students are charged the adult fare.'
                          : 'No current verified student pass is linked to this account; student passengers are estimated at the adult fare.'}
                      </p>
                      {fareQuoteError && <p className="auth-message error" role="alert">{fareQuoteError}</p>}
                      <button
                        className="button button-primary fare-quote-button"
                        type="submit"
                        disabled={fareQuoteLoading || !destinationSequence || !PASSENGER_CATEGORIES.some(({ key }) => Number(passengerCounts[key]) > 0)}
                      >
                        {fareQuoteLoading ? 'Calculating…' : 'Get fare estimate'}
                      </button>
                      {fareQuote && (
                        <article className="fare-quote-result">
                          <div className="fare-quote-heading">
                            <div><span>ESTIMATED FARE</span><strong>{formatCurrency(fareQuote.fare.total, fareQuote.fare.currency)}</strong></div>
                            <small>{fareQuote.fare.chargeableStages} stage{fareQuote.fare.chargeableStages === 1 ? '' : 's'} · about {fareQuote.fare.estimatedDistanceKm} km</small>
                          </div>
                          <p className="fare-quote-journey">{fareQuote.boardingStop.name} <span aria-hidden="true">→</span> {fareQuote.destinationStop.name}</p>
                          <ul className="fare-quote-lines">
                            {fareQuote.fare.lineItems.map((item) => {
                              const label = PASSENGER_CATEGORIES.find((category) => category.key === item.category)?.label || item.category;
                              const detail = item.category === 'student'
                                ? `${item.verifiedPassCount} pass-covered · ${item.billableCount} charged at adult rate`
                                : `${item.count} passenger${item.count === 1 ? '' : 's'}`;
                              return (
                                <li key={item.category}>
                                  <span><strong>{label}</strong><small>{detail}</small></span>
                                  <b>{formatCurrency(item.subtotal, fareQuote.fare.currency)}</b>
                                </li>
                              );
                            })}
                          </ul>
                          <p className="fare-quote-source">{fareQuote.fareSchedule.sourceLabel}. Estimate uses the sample rule of 3 traveled stop intervals per 2 km fare stage.</p>
                          <p className="ticket-create-note">Payment processing is not connected in this prototype; confirmation records a demo ticket.</p>
                          {ticketIssueError && <p className="auth-message error" role="alert">{ticketIssueError}</p>}
                          <button
                            className="button button-primary fare-quote-button"
                            type="button"
                            onClick={handleIssueTicket}
                            disabled={ticketIssueLoading}
                          >
                            {ticketIssueLoading ? 'Creating ticket…' : 'Confirm and issue demo ticket'}
                          </button>
                        </article>
                      )}
                    </form>
                  ) : (
                    <p className="boarding-next-phase">No destination is available until the conductor sets the current stop.</p>
                  )}
                </article>
              ) : boardingInfo ? (
                <article className="boarding-result boarding-no-trip">
                  <div className="boarding-result-bus"><span>BUS</span><strong>{boardingInfo.bus.registrationNumber}</strong></div>
                  <p>This bus is registered, but it has no active trip right now. Check with the conductor before boarding.</p>
                </article>
              ) : null}
            </section>
            <section className="ticket-history" aria-labelledby="ticket-history-title">
              <div className="ticket-history-heading">
                <div>
                  <p className="eyebrow">YOUR ACCOUNT</p>
                  <h2 id="ticket-history-title">Ticket history</h2>
                </div>
                <span>{ticketHistory.length} ticket{ticketHistory.length === 1 ? '' : 's'}</span>
              </div>
              {ticketHistoryLoading && <p className="auth-hint" role="status">Loading your tickets…</p>}
              {ticketHistoryError && <p className="auth-message error" role="alert">{ticketHistoryError}</p>}
              {!ticketHistoryLoading && ticketHistory.length === 0 ? (
                <p className="ticket-history-empty">Your confirmed demo tickets will appear here.</p>
              ) : (
                <div className="ticket-history-content">
                  <div className="ticket-history-list" aria-label="Select a ticket to view its QR code">
                    {ticketHistory.map((ticket) => (
                      <button
                        className={activeTicket?.publicId === ticket.publicId ? 'ticket-history-item selected' : 'ticket-history-item'}
                        type="button"
                        key={ticket.publicId}
                        onClick={() => setActiveTicket(ticket)}
                      >
                        <span><strong>{ticket.reference}</strong><small>{ticket.boardingStop.name} to {ticket.destinationStop.name}</small></span>
                        <b>{formatCurrency(ticket.fare.total, ticket.fare.currency)}</b>
                      </button>
                    ))}
                  </div>
                  {activeTicket && <PassengerTicketCard ticket={activeTicket} />}
                </div>
              )}
            </section>
            {message && <p className={`auth-message ${messageType}`} role="status">{message}</p>}
            <button className="button button-secondary auth-submit" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        ) : (
          <>
            <h1>{mode === 'register' ? <>Create your<br /><span>passenger account.</span></> : <>Welcome<br /><span>aboard.</span></>}</h1>
            <p className="portal-description">Sign in or create an account to estimate your fare and create a demo digital ticket.</p>

            <div className="auth-switch" role="tablist" aria-label="Passenger account options">
              <button className={mode === 'login' ? 'selected' : ''} type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(''); }}>Sign in</button>
              <button className={mode === 'register' ? 'selected' : ''} type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(''); }}>Create account</button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label htmlFor="passenger-name">
                  Full name
                  <input id="passenger-name" name="fullName" type="text" autoComplete="name" minLength={2} maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
              )}
              <label htmlFor="passenger-email">
                Email address
                <input id="passenger-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label htmlFor="passenger-password">
                Password
                <input id="passenger-password" name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {mode === 'register' && <p className="auth-hint">Use at least 8 characters. A student fare benefit requires a separately verified pass.</p>}
              {message && <p className={`auth-message ${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
              <button className="button button-primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
