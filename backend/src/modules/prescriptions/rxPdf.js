'use strict';

const { PdfDoc } = require('../../lib/pdf');
const { encodeQr } = require('../../lib/qr');

const L = 50;
const R = PdfDoc.W - 50;
const BODY_LIMIT = 585; // darunter beginnt der Unterschrifts-/Code-Bereich

const fmtDate = (ms) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const fmtDob = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Einfacher Zeilenumbruch nach Zeichenzahl (Helvetica: ca. 0,5 em je Zeichen). */
function wrap(text, maxChars) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      while (word.length > maxChars) {
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Druckbild des Privatrezepts (A4). Bei langen Verordnungen läuft der Text auf Folgeseiten;
 * Unterschrift und Code stehen immer auf der letzten Seite.
 */
function renderPrescriptionPdf({ rx, content, org, prescriber, printNo }) {
  const duplicate = printNo > 1;
  const doc = new PdfDoc({ title: `Privatrezept ${rx.serial}`, author: org ? org.name : 'PrescriptCheck', subject: 'Privatrezept' });
  const pages = [];
  let page;
  let y;

  const startPage = (first) => {
    page = doc.addPage();
    pages.push(page);
    if (first) {
      y = 60;
      page.text(L, y, org ? org.name : '', { size: 15, bold: true });
      y += 16;
      const a = (org && org.address) || {};
      for (const line of [a.street, [a.zip, a.city].filter(Boolean).join(' '), a.phone ? `Tel. ${a.phone}` : null].filter(Boolean)) {
        page.text(L, y, line, { size: 10, gray: 0.25 });
        y += 13;
      }
      page.text(R - 140, 60, 'PRIVATREZEPT', { size: 15, bold: true });
      if (duplicate) page.text(R - 140, 76, `DUPLIKAT – Ausdruck ${printNo}`, { size: 10, bold: true });
      y = Math.max(y, 100) + 14;
      page.line(L, y, R, y, { width: 1 });
      y += 24;
    } else {
      y = 60;
      page.text(L, y, `Privatrezept ${rx.serial} – Fortsetzung`, { size: 11, bold: true });
      y += 22;
    }
  };
  const ensureSpace = (h) => {
    if (y + h > BODY_LIMIT) startPage(false);
  };

  startPage(true);

  // Patient (links, ggf. zweizeilig) und Datumsangaben (rechts)
  page.text(L, y, 'Patient/in', { size: 9, gray: 0.4 });
  page.text(R - 200, y, 'Ausstellungsdatum', { size: 9, gray: 0.4 });
  page.text(R - 90, y, 'Gültig bis', { size: 9, gray: 0.4 });
  const nameLines = wrap(content.patient.name, 34);
  page.text(R - 200, y + 15, fmtDate(rx.issuedAt), { size: 12 });
  page.text(R - 90, y + 15, fmtDate(rx.expiresAt), { size: 12 });
  let py = y + 15;
  for (const line of nameLines) {
    page.text(L, py, line, { size: 12, bold: true });
    py += 15;
  }
  page.text(L, py - 1, `geb. ${fmtDob(content.patient.dob)}`, { size: 11 });
  y = py + 28;

  page.text(L, y, 'Verordnung', { size: 9, gray: 0.4 });
  y += 6;
  page.line(L, y, R, y);
  y += 18;

  content.items.forEach((it, i) => {
    const title = wrap(it.medication, 66);
    const meta = wrap([it.form, it.strength, `Menge: ${it.quantity}`].filter(Boolean).join('  ·  '), 86);
    const dosage = it.dosage ? wrap(`Dosierung: ${it.dosage}`, 86) : [];
    ensureSpace(title.length * 15 + (meta.length + dosage.length) * 14 + 12);
    page.text(L, y, `${i + 1}.`, { size: 11, bold: true });
    for (const line of title) {
      page.text(L + 18, y, line, { size: 12, bold: true });
      y += 15;
    }
    for (const line of meta) {
      page.text(L + 18, y, line, { size: 10.5 });
      y += 14;
    }
    for (const line of dosage) {
      page.text(L + 18, y, line, { size: 10.5 });
      y += 14;
    }
    y += 8;
  });

  if (content.note) {
    const noteLines = wrap(content.note, 88);
    ensureSpace(20 + noteLines.length * 14);
    y += 4;
    page.text(L, y, 'Hinweis', { size: 9, gray: 0.4 });
    y += 13;
    for (const line of noteLines) {
      page.text(L, y, line, { size: 10.5 });
      y += 14;
    }
  }

  // Unterschrift und Code auf der letzten Seite
  const last = pages[pages.length - 1];
  const sy = 640;
  last.line(L, sy, L + 230, sy);
  last.text(L, sy + 13, 'Unterschrift und Stempel der verordnenden Person', { size: 8.5, gray: 0.4 });
  if (prescriber) last.text(L, sy + 26, prescriber.name, { size: 10, bold: true });
  const qr = encodeQr(rx.code);
  const qrSize = 150;
  const qx = R - qrSize;
  const qy = 600;
  last.qr(qx, qy, qrSize, qr.modules);
  last.text(qx, qy + qrSize + 4, rx.serial, { size: 12, bold: true });
  last.text(qx, qy + qrSize + 18, 'Echtheit und Status: Prüfung durch Apotheken', { size: 7.5, gray: 0.4 });
  last.text(qx, qy + qrSize + 27, 'in PrescriptCheck (QR-Code oder Rezept-ID).', { size: 7.5, gray: 0.4 });

  pages.forEach((p, i) => {
    p.line(L, 800, R, 800, { gray: 0.6 });
    p.text(L, 813, `Rezept-ID ${rx.serial}  ·  PrescriptCheck – AT Medical GmbH  ·  Seite ${i + 1} von ${pages.length}`, { size: 8, gray: 0.4 });
    if (duplicate) p.textRotated(150, 520, 'DUPLIKAT', { size: 90, gray: 0.88, angle: 35 });
  });
  return doc.toBuffer();
}

module.exports = { renderPrescriptionPdf, wrap };
