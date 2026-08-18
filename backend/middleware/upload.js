const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Scanned copies are stored on disk here (not in the DB — only the path is stored).
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'copies');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_COPY_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const copyStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ext = ALLOWED_COPY_TYPES[file.mimetype] || path.extname(file.originalname) || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

// Attach/replace a student's scanned copy — PDF or a photo of the paper.
const copyUpload = multer({
  storage: copyStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_COPY_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error('Only PDF, JPG, PNG or WEBP files are allowed for a copy'));
  },
});

// Bulk-import a class list of submissions. CSV or Excel, one or many files at
// once. Kept in memory only — never written to disk, just parsed and discarded.
const ALLOWED_IMPORT_EXT = ['.csv', '.xlsx', '.xls'];
const ALLOWED_IMPORT_MIME = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 }, // 5MB per file, up to 20 files
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const okExt = ALLOWED_IMPORT_EXT.some((ext) => lower.endsWith(ext));
    const okType = ALLOWED_IMPORT_MIME.includes(file.mimetype);
    if (okExt || okType) return cb(null, true);
    cb(new Error('Only .csv, .xlsx or .xls files are allowed for import'));
  },
});

module.exports = { copyUpload, importUpload, UPLOAD_ROOT };