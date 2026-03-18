// ============================================================
//  middleware/upload.js
//  Multer 2.x configuration for handling photo uploads
//  NOTE: Multer 2.x changed the API slightly from 1.x
// ============================================================

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists on startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Storage engine ──────────────────────────────────────────
// Saves uploaded files to /uploads/ with a unique timestamped name
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `UF-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

// ── File filter ─────────────────────────────────────────────
// Only accept image files
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // In multer 2.x, pass an Error to reject
    cb(Object.assign(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF).'), { code: 'INVALID_FILE_TYPE' }), false);
  }
};

// ── Multer instance ─────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize : 10 * 1024 * 1024,  // 10 MB per file
    files    : 1                   // max 1 file per request
  }
});

module.exports = upload;