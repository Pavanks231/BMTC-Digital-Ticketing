import { useEffect, useId, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { parseStudentPassQrValue } from '../services/studentPassQr.js';
import './BusQrScanner.css';

export default function StudentPassQrScanner({ onPassScanned, disabled = false }) {
  const readerId = `student-pass-qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef(null);
  const scanHandledRef = useRef(false);
  const [cameraState, setCameraState] = useState('stopped');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const state = scanner.getState();
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    }
  }, []);

  async function disposeScanner(scanner) {
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch {
      // The camera may already have stopped after a decoded pass.
    }
    try { scanner.clear(); } catch { /* The view may already have been cleared. */ }
    if (scannerRef.current === scanner) scannerRef.current = null;
    setCameraState('stopped');
  }

  async function handleDecodedValue(decodedValue, scanner) {
    if (scanHandledRef.current) return;
    scanHandledRef.current = true;
    setCameraState('checking');
    const publicId = parseStudentPassQrValue(decodedValue);
    await disposeScanner(scanner);
    if (!publicId) {
      setCameraError('This is not a BMTC student pass QR. Ask the student to open their active pass.');
      return;
    }
    setCameraError('');
    onPassScanned(publicId);
  }

  async function startCamera() {
    if (scannerRef.current) return;
    setCameraError('');
    scanHandledRef.current = false;
    setCameraState('starting');
    const scanner = new Html5Qrcode(readerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedValue) => handleDecodedValue(decodedValue, scanner),
        () => {},
      );
      if (!scanHandledRef.current) setCameraState('scanning');
    } catch (error) {
      await disposeScanner(scanner);
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow camera access for this local site and try again.'
        : 'Could not start the camera. Check that a camera is available and try again.');
    }
  }

  async function stopCamera() {
    if (scannerRef.current) await disposeScanner(scannerRef.current);
  }

  return (
    <div className="bus-qr-scanner">
      <div className={`qr-camera-view ${cameraState === 'stopped' ? 'hidden' : ''}`} id={readerId} />
      <div className="scanner-controls">
        {cameraState === 'stopped' ? (
          <button className="button button-primary scanner-button" type="button" onClick={startCamera} disabled={disabled}>
            Scan student pass QR <span aria-hidden="true">▣</span>
          </button>
        ) : (
          <button className="button button-secondary scanner-button" type="button" onClick={stopCamera} disabled={cameraState === 'checking'}>
            {cameraState === 'starting' ? 'Starting camera…' : cameraState === 'checking' ? 'Checking pass…' : 'Stop camera'}
          </button>
        )}
        <span className="scanner-state" role="status">
          {cameraState === 'scanning' ? 'Point the camera at the student’s BMTC pass QR.' : ''}
        </span>
      </div>
      {cameraError && <p className="auth-message error scanner-error" role="alert">{cameraError}</p>}
    </div>
  );
}
