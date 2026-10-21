import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './StudentIdCard.css';
import lnhsLogo from '../imports/LNHS LOGO.png';
import bsitSeal from '../imports/TEAM SEAL.png';

const ID_WIDTH_MM = 66;
const ID_HEIGHT_MM = 100;
const CARD_WIDTH = 660;
const ID_HEIGHT_PX = 1000;
const QR_EXPORT_SIZE = 2400;
const SCHOOL_YEAR = '2026-2027';
const VALID_UNTIL = 'March 2027';
const SCHOOL_ID = '301765';
const GAP_PX = 24;

function formatIssuedDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function StudentIdCard({ student, onPrint, onPhotoUpload, onExport }) {
  const [qrImage, setQrImage] = useState('');
  const [scale, setScale] = useState(0.5);
  const [stacked, setStacked] = useState(false);
  const [photoDraft, setPhotoDraft] = useState(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoX, setPhotoX] = useState(0);
  const [photoY, setPhotoY] = useState(0);
  const [photoSaving, setPhotoSaving] = useState(false);
  const viewportRef = useRef(null);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const qrValue = student.qrValue || student.qrUuid || student.studentCode || student.code || student.id;

  useEffect(() => {
    let active = true;
    if (!qrValue) return undefined;
    QRCode.toDataURL(String(qrValue), {
      width: QR_EXPORT_SIZE,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url) => {
      if (active) setQrImage(url);
    }).catch(() => setQrImage(''));
    return () => { active = false; };
  }, [qrValue]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const resize = () => {
      const rect = viewport.getBoundingClientRect();
      const isNarrow = window.innerWidth < 900;
      setStacked(isNarrow);
      const innerW = rect.width - 32;
      const innerH = rect.height - 32;
      let nextScale;
      if (isNarrow) {
        const widthScale = innerW / CARD_WIDTH;
        const heightScale = (innerH / 2 - GAP_PX) / ID_HEIGHT_PX;
        nextScale = Math.min(widthScale, heightScale);
      } else {
        const widthScale = ((innerW - GAP_PX) / 2) / CARD_WIDTH;
        const heightScale = innerH / ID_HEIGHT_PX;
        nextScale = Math.min(widthScale, heightScale);
      }
      setScale(Math.max(Math.min(nextScale, 1), 0.25));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const exportCard = useCallback(async (cardElement) => {
    if (!cardElement) return null;
    const clone = cardElement.cloneNode(true);
    clone.classList.add('student-id-card--export');
    clone.style.width = `${CARD_WIDTH}px`;
    clone.style.height = `${ID_HEIGHT_PX}px`;
    clone.style.maxWidth = 'none';
    clone.style.transform = 'none';
    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.style.boxShadow = 'none';
    document.body.appendChild(clone);
    try {
      return await html2canvas(clone, {
        width: CARD_WIDTH,
        height: ID_HEIGHT_PX,
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
    } finally {
      clone.remove();
    }
  }, []);

  async function downloadPNG() {
    const frontCanvas = await exportCard(frontRef.current);
    const backCanvas = await exportCard(backRef.current);
    const safeId = (student.studentCode || student.code || student.id || 'student')
      .toString()
      .replace(/[^A-Za-z0-9-]/g, '');
    if (frontCanvas) {
      const link = document.createElement('a');
      link.download = `${safeId}-ID-front.png`;
      link.href = frontCanvas.toDataURL('image/png');
      link.click();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (backCanvas) {
      const link = document.createElement('a');
      link.download = `${safeId}-ID-back.png`;
      link.href = backCanvas.toDataURL('image/png');
      link.click();
    }
    onExport?.('png');
  }

  async function downloadPDF() {
    const frontCanvas = await exportCard(frontRef.current);
    const backCanvas = await exportCard(backRef.current);
    if (!frontCanvas && !backCanvas) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [ID_WIDTH_MM, ID_HEIGHT_MM] });
    if (frontCanvas) {
      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, ID_WIDTH_MM, ID_HEIGHT_MM);
    }
    if (backCanvas) {
      if (frontCanvas) pdf.addPage([ID_WIDTH_MM, ID_HEIGHT_MM], 'portrait');
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, ID_WIDTH_MM, ID_HEIGHT_MM);
    }
    const safeId = (student.studentCode || student.code || student.id || 'student')
      .toString()
      .replace(/[^A-Za-z0-9-]/g, '');
    pdf.save(`${safeId}-ID.pdf`);
    onExport?.('pdf');
  }

  function handlePhotoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoDraft({ file, url: URL.createObjectURL(file) });
    setPhotoScale(1);
    setPhotoX(0);
    setPhotoY(0);
    event.target.value = '';
  }

  async function saveCroppedPhoto() {
    if (!photoDraft || !onPhotoUpload) return;
    setPhotoSaving(true);
    try {
      const image = new Image();
      image.src = photoDraft.url;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      const outputSize = 900;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext('2d');
      const coverScale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight) * photoScale;
      const drawWidth = image.naturalWidth * coverScale;
      const drawHeight = image.naturalHeight * coverScale;
      const offsetScale = outputSize / 260;
      context.drawImage(
        image,
        (outputSize - drawWidth) / 2 + photoX * offsetScale,
        (outputSize - drawHeight) / 2 + photoY * offsetScale,
        drawWidth,
        drawHeight,
      );
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Unable to crop the selected photo.');
      await onPhotoUpload(new File([blob], `${student.id || 'student'}-photo.jpg`, { type: 'image/jpeg' }));
      URL.revokeObjectURL(photoDraft.url);
      setPhotoDraft(null);
    } finally {
      setPhotoSaving(false);
    }
  }

  const rawCode = student.studentCode || student.code || student.id;
  const normalizedCode = rawCode
    ? String(rawCode).replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
    : '';
  const studentCode = normalizedCode && !normalizedCode.startsWith('LNHS-')
    ? `LNHS-${normalizedCode}`
    : normalizedCode;
  const issuedDate = formatIssuedDate(
    student.idCardGeneratedAt || student.createdAt || new Date().toISOString(),
  );
  const cardSerial = studentCode ? `${studentCode}-A` : '';
  const cardStyle = { transform: `scale(${scale})` };
  const wrapperStyle = { width: CARD_WIDTH * scale, height: ID_HEIGHT_PX * scale };

  return (
    <div className="student-id-sheet">
      <div className="student-id-toolbar no-print">
        <div className="student-id-toolbar-top">
          <div>
            <span>Portrait CR100 • {ID_WIDTH_MM} × {ID_HEIGHT_MM} mm</span>
          </div>
          <div className="student-id-export-buttons">
            <button type="button" onClick={downloadPNG}>Export PNG</button>
            <button type="button" onClick={downloadPDF}>Export PDF</button>
          </div>
        </div>
      </div>

      <main ref={viewportRef} className="student-id-viewport">
        <div className={`student-id-pair ${stacked ? 'is-stacked' : 'is-side-by-side'}`}>
          <div className="student-id-side">
            <div className="student-id-side__label">FRONT</div>
            <div className="student-id-card-scaler" style={wrapperStyle}>
              <div ref={frontRef} className="student-id-card" data-side="front" style={cardStyle}>
                <div className="student-id-card__front">
                <div className="id-card__goldline" aria-hidden="true" />

                <div className="id-card__gov">
                  <div className="id-card__gov-line">Republic of the Philippines</div>
                  <div className="id-card__gov-line">Department of Education</div>
                  <div className="id-card__gov-line id-card__gov-line--sm">Region IV-B MIMAROPA · Division of Romblon</div>
                </div>

                <div className="id-card__brand">
                  <div className="id-card__brand-seal">
                    <img src={lnhsLogo} alt="LNHS seal" />
                  </div>
                  <div className="id-card__brand-copy">
                    <div className="id-card__brand-filipino">Mataas na Paaralang Nasyonal ng Looc</div>
                    <div className="id-card__brand-name">Looc National High School</div>
                    <div className="id-card__brand-line">Student Identification Card</div>
                  </div>
                </div>

                <div className="id-card__school-id">
                  <span className="id-card__school-id-label">School ID</span>
                  <span className="id-card__school-id-value">{SCHOOL_ID}</span>
                </div>

                <div className="id-card__body">
                  <div className="id-card__photo">
                    {student.photoUrl
                      ? <img src={student.photoUrl} alt={`${student.name} student ID`} />
                      : <span className="id-card__photo-placeholder">PHOTO</span>}
                  </div>

                  <div className="id-card__details">
                    <div className="id-card__name">{student.name || 'Student Name'}</div>
                    <div className="id-card__code">
                      <span className="id-card__code-label">Student No.</span>
                      <span className="id-card__code-value">{studentCode}</span>
                    </div>

                    <dl className="id-card__fields">
                      <div>
                        <dt>School Year</dt>
                        <dd>{SCHOOL_YEAR}</dd>
                      </div>
                      <div>
                        <dt>Strand</dt>
                        <dd>{student.strand || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt>Section</dt>
                        <dd>{student.section || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt>Adviser</dt>
                        <dd>{student.adviser || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt>Validity</dt>
                        <dd>Until {VALID_UNTIL}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="id-card__signatures">
                  <div className="id-card__signature">
                    <div className="id-card__signature-line" />
                    <div className="id-card__signature-label">Student Signature</div>
                  </div>
                  <div className="id-card__signature">
                    <div className="id-card__signature-line" />
                    <div className="id-card__signature-label">Adviser</div>
                  </div>
                </div>

                <div className="id-card__cobrand">
                  <div className="id-card__cobrand-cell">
                    <div className="id-card__cobrand-seal">
                      <img src={lnhsLogo} alt="LNHS seal" />
                    </div>
                    <div className="id-card__cobrand-copy">
                      <div className="id-card__cobrand-label">Issued by</div>
                      <div className="id-card__cobrand-title">Looc National High School</div>
                      <div className="id-card__cobrand-sub">Senior High School</div>
                    </div>
                  </div>
                  <div className="id-card__cobrand-cell">
                    <div className="id-card__cobrand-seal">
                      <img src={bsitSeal} alt="BSIT Builders seal" />
                    </div>
                    <div className="id-card__cobrand-copy">
                      <div className="id-card__cobrand-label">Produced by</div>
                      <div className="id-card__cobrand-title">Romblon State University</div>
                      <div className="id-card__cobrand-sub">BSIT Capstone 2026</div>
                    </div>
                  </div>
                </div>

                <div className="id-card__foot">
                  <span>Property of Looc National High School</span>
                  <span>Valid for school attendance only</span>
                </div>

                <div className="id-card__goldline id-card__goldline--bottom" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>

          <div className="student-id-side">
            <div className="student-id-side__label">BACK</div>
            <div className="student-id-card-scaler" style={wrapperStyle}>
              <div ref={backRef} className="student-id-card" data-side="back" style={cardStyle}>
                <div className="student-id-card__back">
                <div className="id-card__goldline" aria-hidden="true" />

                <div className="id-card__back-header">
                  <div className="id-card__back-brand">Looc National High School</div>
                  <div className="id-card__back-brand-sub">Attendance Monitoring System</div>
                </div>

                <div className="id-card__back-qr-frame">
                  <div className="id-card__back-qr">
                    {qrImage
                      ? <img src={qrImage} alt="Student attendance QR code" />
                      : <span className="id-card__qr-fallback">QR unavailable</span>}
                  </div>
                </div>

                <div className="id-card__back-caption">SCAN FOR ATTENDANCE</div>
                <div className="id-card__back-sub">Present this side to the attendance scanner at the gate.</div>

                <div className="id-card__back-steps">
                  <div className="id-card__back-steps-title">How to use this card</div>
                  <ol className="id-card__back-steps-list">
                    <li>Present this side to the attendance scanner at the school gate.</li>
                    <li>Wait for the scanner to confirm your attendance.</li>
                    <li>Keep the QR code clean and fully visible at all times.</li>
                  </ol>
                </div>

                <div className="id-card__back-note">
                  This card is the property of Looc National High School. If found, please return it to the school office.
                  Do not bend, punch, or expose the QR code to heat or moisture.
                </div>

                <div className="id-card__back-footer">
                  <div className="id-card__back-footer-row">
                    <span>School ID</span>
                    <strong>{SCHOOL_ID}</strong>
                  </div>
                  <div className="id-card__back-footer-row">
                    <span>Issued</span>
                    <strong>{issuedDate}</strong>
                  </div>
                  <div className="id-card__back-footer-row">
                    <span>Card Serial</span>
                    <strong>{cardSerial}</strong>
                  </div>
                  <div className="id-card__back-footer-row">
                    <span>Valid until</span>
                    <strong>{VALID_UNTIL}</strong>
                  </div>
                </div>

                <div className="id-card__goldline id-card__goldline--bottom" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="student-id-card__controls no-print">
        {onPhotoUpload && (
          <label className="student-id-print student-id-photo-button">
            {student.photoUrl ? 'Replace Photo' : 'Add Photo'}
            <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoSelect} />
          </label>
        )}
        {onPrint && (
          <button className="student-id-print" type="button" onClick={onPrint}>Print Student ID</button>
        )}
      </div>

      {photoDraft && (
        <div className="student-id-crop-editor no-print">
          <div className="student-id-crop-preview">
            <img
              src={photoDraft.url}
              alt="Crop preview"
              style={{ transform: `translate(${photoX}px, ${photoY}px) scale(${photoScale})` }}
            />
          </div>
          <div className="student-id-crop-controls">
            <label>Zoom <input type="range" min="1" max="2.5" step="0.01" value={photoScale} onChange={(event) => setPhotoScale(Number(event.target.value))} /></label>
            <label>Horizontal <input type="range" min="-80" max="80" value={photoX} onChange={(event) => setPhotoX(Number(event.target.value))} /></label>
            <label>Vertical <input type="range" min="-80" max="80" value={photoY} onChange={(event) => setPhotoY(Number(event.target.value))} /></label>
          </div>
          <div className="student-id-crop-actions">
            <button type="button" className="student-id-print student-id-print-secondary" onClick={() => { URL.revokeObjectURL(photoDraft.url); setPhotoDraft(null); }}>Cancel</button>
            <button type="button" className="student-id-print" onClick={saveCroppedPhoto} disabled={photoSaving}>
              {photoSaving ? 'Saving Photo…' : 'Save Photo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
