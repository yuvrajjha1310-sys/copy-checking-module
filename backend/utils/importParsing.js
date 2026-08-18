const XLSX = require('xlsx');

// ─────────────────────────────────────────────────────────────
// CSV parsing/writing — no external dependency needed, the data
// is simple/tabular enough to hand-roll.
// ─────────────────────────────────────────────────────────────

// Parses CSV text into an array of row-objects keyed by the (lower-cased,
// trimmed) header. Handles quoted fields with embedded commas/quotes/newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushField();
      pushRow();
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

// Escapes a single value for safe CSV output.
function csvValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Builds a CSV string (with header row) from an array of row-objects.
function toCsv(columns, rows) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) => columns.map((c) => csvValue(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

// ─────────────────────────────────────────────────────────────
// Excel parsing (.xlsx / .xls), via the `xlsx` package. Reads the
// first sheet and normalizes keys the same way parseCsv does, so
// downstream field-mapping code doesn't care which format it got.
// ─────────────────────────────────────────────────────────────
function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  return rows.map((r) => {
    const obj = {};
    Object.keys(r).forEach((key) => {
      obj[key.trim().toLowerCase()] = String(r[key]).trim();
    });
    return obj;
  });
}

// Picks the right parser based on the uploaded file's name/mimetype.
function parseImportFile(originalName, mimetype, buffer) {
  const lower = (originalName || '').toLowerCase();
  const isSpreadsheet =
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel';

  if (isSpreadsheet) return parseSpreadsheet(buffer);
  return parseCsv(buffer.toString('utf-8'));
}

module.exports = { parseCsv, toCsv, parseSpreadsheet, parseImportFile };