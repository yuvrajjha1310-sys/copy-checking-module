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

// CSV for bulk-importing a class list of submissions. Kept in memory only —
// we parse it and never write the raw file to disk.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const okType = ['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype);
    const okExt = file.originalname.toLowerCase().endsWith('.csv');
    if (okType || okExt) return cb(null, true);
    cb(new Error('Only .csv files are allowed for import'));
  },
});

module.exports = { copyUpload, csvUpload, UPLOAD_ROOT };