'use strict';

/**
 * Minimaler PDF-Writer (PDF 1.4, A4, Standardschriften Helvetica/Helvetica-Bold,
 * WinAnsi-Kodierung). Keine Abhängigkeiten. Reicht für das Rezeptformular:
 * Text, Linien, Rechtecke (auch gefüllt) und Vektor-QR-Codes.
 */

const WIN_ANSI_EXTRA = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };

function encodeText(str) {
  let out = '';
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    let byte;
    if (WIN_ANSI_EXTRA[ch] !== undefined) byte = WIN_ANSI_EXTRA[ch];
    else if (cp >= 32 && cp <= 126) byte = cp;
    else if (cp >= 160 && cp <= 255) byte = cp;
    else byte = 63; // '?'
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

const num = (n) => (Math.round(n * 1000) / 1000).toString();

class PdfPage {
  constructor() {
    this.ops = [];
  }

  /** Koordinaten in Punkt (1/72"), Ursprung links oben (wird intern umgerechnet). */
  text(x, y, str, { size = 11, bold = false, gray = 0 } = {}) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(gray)} g 1 0 0 1 ${num(x)} ${num(PdfDoc.H - y)} Tm (${encodeText(str)}) Tj ET`);
  }

  line(x1, y1, x2, y2, { width = 0.5, gray = 0 } = {}) {
    this.ops.push(`${num(gray)} G ${num(width)} w ${num(x1)} ${num(PdfDoc.H - y1)} m ${num(x2)} ${num(PdfDoc.H - y2)} l S`);
  }

  rect(x, y, w, h, { fill = false, width = 0.5, gray = 0 } = {}) {
    if (fill) this.ops.push(`${num(gray)} g ${num(x)} ${num(PdfDoc.H - y - h)} ${num(w)} ${num(h)} re f`);
    else this.ops.push(`${num(gray)} G ${num(width)} w ${num(x)} ${num(PdfDoc.H - y - h)} ${num(w)} ${num(h)} re S`);
  }

  /** Gedrehter Text (z. B. Wasserzeichen), Winkel in Grad. */
  textRotated(x, y, str, { size = 60, bold = true, gray = 0.85, angle = 35 } = {}) {
    const a = (angle * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(gray)} g ${num(c)} ${num(s)} ${num(-s)} ${num(c)} ${num(x)} ${num(PdfDoc.H - y)} Tm (${encodeText(str)}) Tj ET`);
  }

  /** QR-Matrix als Vektor-Rechtecke (zeilenweise zusammengefasst). */
  qr(x, y, size, modules, quiet = 4) {
    const n = modules.length;
    const cell = size / (n + quiet * 2);
    this.ops.push('0 g');
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!modules[r][c]) {
          c++;
          continue;
        }
        let end = c;
        while (end < n && modules[r][end]) end++;
        const rx = x + (quiet + c) * cell;
        const ry = PdfDoc.H - (y + (quiet + r + 1) * cell);
        this.ops.push(`${num(rx)} ${num(ry)} ${num((end - c) * cell)} ${num(cell)} re f`);
        c = end;
      }
    }
  }
}

class PdfDoc {
  constructor({ title = '', author = '', subject = '' } = {}) {
    this.pages = [];
    this.info = { title, author, subject };
  }

  addPage() {
    const p = new PdfPage();
    this.pages.push(p);
    return p;
  }

  toBuffer() {
    const objs = []; // 1-basiert: objs[i-1]
    const add = (body) => {
      objs.push(body);
      return objs.length;
    };
    const catalogId = add(null);
    const pagesId = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const infoId = add(
      `<< /Title (${encodeText(this.info.title)}) /Author (${encodeText(this.info.author)}) /Subject (${encodeText(this.info.subject)}) /Producer (PrescriptCheck) >>`
    );
    const pageIds = this.pages.map((p) => {
      const stream = p.ops.join('\n');
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PdfDoc.W} ${PdfDoc.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, 'latin1'));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}

PdfDoc.W = 595.28;
PdfDoc.H = 841.89;

module.exports = { PdfDoc };
