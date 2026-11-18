import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import './TicketQrCode.css';

export default function TicketQrCode({ value, reference, caption = 'Show this code to the conductor.', purpose = 'ticket' }) {
  const [qrImage, setQrImage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setQrImage('');
    setError('');
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#173f31', light: '#ffffff' },
    })
      .then((dataUrl) => { if (active) setQrImage(dataUrl); })
      .catch(() => { if (active) setError('Could not display this ticket QR code.'); });
    return () => { active = false; };
  }, [value]);

  return (
    <figure className="ticket-qr">
      {qrImage ? (
          <img
            src={qrImage}
            alt={purpose === 'student-pass' ? 'Student travel pass QR code' : `Secure ticket QR code ${reference}`}
          />
      ) : (
        <span className="ticket-qr-placeholder" role={error ? 'alert' : 'status'}>{error || 'Preparing ticket QR…'}</span>
      )}
      {qrImage && <a href={qrImage} download={`bmtc-${purpose}-${reference || 'qr'}.png`}>Download QR</a>}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
