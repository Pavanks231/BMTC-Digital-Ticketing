import { Link } from 'react-router-dom';

const steps = [
  { number: '01', title: 'Find your bus', text: 'Scan the bus QR code to start your journey.' },
  { number: '02', title: 'Choose your stop', text: 'Select where you are heading and who is travelling.' },
  { number: '03', title: 'Ride with your ticket', text: 'Show your ticket QR code to the conductor.' },
];

export default function HomePage() {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> DIGITAL TICKETING FOR BENGALURU</p>
          <h1>Your bus ride,<br /><span>one QR away.</span></h1>
          <p className="hero-description">
            Plan your trip, see your fare, and keep your ticket on your phone.
            A smoother ride starts before you board.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/passenger">I’m a passenger <span aria-hidden="true">↗</span></Link>
            <Link className="button button-secondary" to="/conductor">Conductor sign in <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-trust">
            <span className="trust-icon" aria-hidden="true">✓</span>
            <span>Simple to use <i /> Secure QR tickets <i /> Built for bus travel</span>
          </div>
        </div>

        <div className="hero-art" role="img" aria-label="Illustration of a sample digital bus ticket">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="ticket-card">
            <div className="ticket-topline"><span className="ticket-kicker">SAMPLE TICKET PREVIEW</span><span className="ticket-live"><i /> DEMO</span></div>
            <div className="ticket-route">
              <div className="route-stop"><span className="stop-dot stop-start" /><span><small>BOARDING</small><strong>Your bus stop</strong></span></div>
              <div className="route-line"><span>BUS JOURNEY</span></div>
              <div className="route-stop"><span className="stop-dot stop-end" /><span><small>DESTINATION</small><strong>Choose a stop</strong></span></div>
            </div>
            <div className="ticket-divider"><span /><span /></div>
            <div className="ticket-bottom"><div><small>YOUR TICKET</small><strong>Digital &amp; ready to show</strong></div><div className="fake-qr" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
          </div>
          <div className="art-caption"><span className="caption-icon" aria-hidden="true">⌁</span><span><strong>One less thing to carry</strong><small>Your ticket stays right here.</small></span></div>
          <div className="art-spark spark-one" aria-hidden="true">✳</div>
          <div className="art-spark spark-two" aria-hidden="true">✳</div>
        </div>
      </section>

      <section className="how-section">
        <div className="page-width">
          <div className="section-heading">
            <div><p className="eyebrow">THREE QUICK STEPS</p><h2>From bus to destination.</h2></div>
            <p>Everything you need for the ride, in one simple flow.</p>
          </div>
          <div className="step-grid">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="role-section page-width">
        <div className="role-panel">
          <div className="role-panel-copy"><p className="eyebrow">MADE FOR THE WHOLE JOURNEY</p><h2>One service.<br />Two ways in.</h2><p>Browse route and stop details, or sign in to see the conductor's assigned trip.</p></div>
          <div className="role-links">
            <Link className="role-link" to="/passenger"><span className="role-icon passenger-icon" aria-hidden="true">P</span><span><small>FOR RIDERS</small><strong>Passenger portal</strong></span><span className="role-arrow" aria-hidden="true">↗</span></Link>
            <Link className="role-link" to="/conductor"><span className="role-icon conductor-icon" aria-hidden="true">C</span><span><small>FOR THE CREW</small><strong>Conductor portal</strong></span><span className="role-arrow" aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
