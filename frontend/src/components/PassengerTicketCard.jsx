import TicketQrCode from './TicketQrCode.jsx';
import './PassengerTicketCard.css';

const CATEGORY_LABELS = {
  general: 'Adult / general',
  child: 'Child',
  senior_citizen: 'Senior citizen',
  student: 'Student',
};

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatIssuedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently issued';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function PassengerTicketCard({ ticket }) {
  return (
    <article className="passenger-ticket-card" aria-labelledby="ticket-card-title">
      <div className="ticket-card-header">
        <div>
          <p className="eyebrow">DIGITAL TICKET</p>
          <h3 id="ticket-card-title">Ticket {ticket.reference}</h3>
          <small>Issued {formatIssuedAt(ticket.issuedAt)}</small>
        </div>
        <span className={`ticket-status ticket-status-${ticket.status}`}>{ticket.status}</span>
      </div>
      <div className="ticket-card-main">
        <TicketQrCode value={ticket.qrValue} reference={ticket.reference} />
        <div className="ticket-card-details">
          <p className="ticket-route-label">Route {ticket.trip.routeCode} · {ticket.trip.direction}</p>
          <strong>{ticket.trip.routeName}</strong>
          <p className="ticket-journey"><span>{ticket.boardingStop.name}</span><i aria-hidden="true">→</i><span>{ticket.destinationStop.name}</span></p>
          <ul className="ticket-fare-items">
            {ticket.fare.lineItems.map((item) => (
              <li key={item.category}>
                <span>{CATEGORY_LABELS[item.category] || item.category} × {item.count}</span>
                <b>{formatCurrency(item.subtotal, ticket.fare.currency)}</b>
              </li>
            ))}
          </ul>
          <div className="ticket-total">
            <span>Total fare</span>
            <strong>{formatCurrency(ticket.fare.total, ticket.fare.currency)}</strong>
          </div>
          <p className="ticket-payment-note">
            {ticket.paymentStatus === 'not_required'
              ? 'No ride fare is due for the pass-covered ticket.'
              : 'Prototype ticket: payment processing is not integrated.'}
          </p>
        </div>
      </div>
      <p className="ticket-privacy-note">The QR contains only a random ticket identifier. Ticket details stay in your account and are checked by the server.</p>
    </article>
  );
}
