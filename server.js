// ============================================================
//  UrbanFix — Smart City Complaint Management System
//  server.js  (Node.js + Express + SQLite)
//  Fixed: multer 2.x, Windows path compatibility, error handling
// ============================================================

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const db     = require('./db/database');
const upload = require('./middleware/upload');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded photos at /uploads/filename
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter — prevent complaint spam (20 per 15 min per IP)
const submitLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 20,
  message  : { error: 'Too many submissions. Please wait 15 minutes and try again.' }
});

// ── HELPERS ──────────────────────────────────────────────────
function generateId() {
  return `UF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const EMOJI_MAP = {
  'Pothole / Road'     : '🛣️',
  'Garbage / Waste'    : '🗑️',
  'Broken Streetlight' : '💡',
  'Water Leakage'      : '💧',
  'Other'              : '📋'
};
const CAT_MAP = {
  'Pothole / Road'     : 'road',
  'Garbage / Waste'    : 'garbage',
  'Broken Streetlight' : 'light',
  'Water Leakage'      : 'water',
  'Other'              : 'other'
};
const DEPT_MAP = {
  'Pothole / Road'     : 'Public Works Department',
  'Garbage / Waste'    : 'Sanitation & Health Dept',
  'Broken Streetlight' : 'DISCOM — Power Dept',
  'Water Leakage'      : 'Water Supply Board',
  'Other'              : 'Municipal Office'
};

// Ward → SVG map coordinates (with jitter applied at runtime)
const WARD_COORDS = {
  'Ward 1 — Central Market'    : { x: 108, y: 74  },
  'Ward 2 — North Residential' : { x: 308, y: 198 },
  'Ward 3 — Industrial Zone'   : { x: 634, y: 74  },
  'Ward 4 — Old Town'          : { x: 893, y: 168 },
  'Ward 5 — South Park'        : { x: 108, y: 395 },
  'Ward 6 — Tech Corridor'     : { x: 366, y: 534 },
  'Ward 7 — East Village'      : { x: 634, y: 534 },
  'Ward 8 — West End'          : { x: 893, y: 492 },
};

// ═══════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════

// Home → serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── [POST] /api/complaints ───────────────────────────────────
// Submit a new complaint with optional photo upload
app.post('/api/complaints', submitLimiter, (req, res) => {
  // Use multer upload as middleware, catch its errors manually
  upload.single('photo')(req, res, (uploadErr) => {

    // Handle multer-specific errors
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Photo must be under 10 MB.' });
      }
      if (uploadErr.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: uploadErr.message });
      }
      return res.status(400).json({ error: uploadErr.message || 'File upload failed.' });
    }

    try {
      const { name, contact, ward, type, description, priority, lat, lng } = req.body;

      // ── Validation ──────────────────────────────────────
      if (!name || !name.trim())        return res.status(400).json({ error: 'Name is required.' });
      if (!contact || !contact.trim())  return res.status(400).json({ error: 'Contact is required.' });
      if (!ward)                         return res.status(400).json({ error: 'Ward is required.' });
      if (!type)                         return res.status(400).json({ error: 'Issue type is required.' });
      if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required.' });
      if (description.length > 500)     return res.status(400).json({ error: 'Description must be under 500 characters.' });

      const id         = generateId();
      const emoji      = EMOJI_MAP[type]  || '📋';
      const cat        = CAT_MAP[type]    || 'other';
      const department = DEPT_MAP[type]   || 'Municipal Office';
      const photoPath  = req.file ? `/uploads/${req.file.filename}` : null;
      const now        = new Date().toISOString();

      // Jitter the map pin so multiple ward complaints don't stack
      const base  = WARD_COORDS[ward] || { x: 500, y: 321 };
      const mapX  = base.x + Math.floor(Math.random() * 50 - 25);
      const mapY  = base.y + Math.floor(Math.random() * 50 - 25);

      // ── Insert complaint ─────────────────────────────────
      db.prepare(`
        INSERT INTO complaints
          (id, name, contact, ward, type, cat, emoji, description, priority,
           status, department, worker, photo_path, lat, lng, map_x, map_y, created_at, updated_at)
        VALUES
          (@id,@name,@contact,@ward,@type,@cat,@emoji,@description,@priority,
           'New',@department,'Unassigned',@photo_path,@lat,@lng,@map_x,@map_y,@now,@now)
      `).run({
        id,
        name         : name.trim(),
        contact      : contact.trim(),
        ward,
        type,
        cat,
        emoji,
        description  : description.trim(),
        priority     : priority || 'Medium',
        department,
        photo_path   : photoPath,
        lat          : parseFloat(lat)  || null,
        lng          : parseFloat(lng)  || null,
        map_x        : mapX,
        map_y        : mapY,
        now
      });

      // ── Log the submission ───────────────────────────────
      db.prepare(`
        INSERT INTO activity_log (complaint_id, action, actor, note, created_at)
        VALUES (?,?,?,?,?)
      `).run(id, 'Submitted', name.trim(), `Complaint registered and routed to ${department}`, now);

      return res.status(201).json({ success: true, id, department });

    } catch (err) {
      console.error('[POST /api/complaints]', err);
      return res.status(500).json({ error: 'Server error. Please try again.' });
    }
  });
});

// ── [GET] /api/complaints ────────────────────────────────────
// List complaints with optional query filters
app.get('/api/complaints', (req, res) => {
  try {
    const { status, type, ward, priority, search, limit = 100, offset = 0 } = req.query;

    let sql  = 'SELECT * FROM complaints WHERE 1=1';
    const p  = [];

    if (status)   { sql += ' AND status = ?';       p.push(status); }
    if (type)     { sql += ' AND type LIKE ?';       p.push(`%${type}%`); }
    if (ward)     { sql += ' AND ward = ?';          p.push(ward); }
    if (priority) { sql += ' AND priority = ?';      p.push(priority); }
    if (search) {
      sql += ' AND (id LIKE ? OR name LIKE ? OR description LIKE ? OR ward LIKE ? OR type LIKE ?)';
      const q = `%${search}%`;
      p.push(q, q, q, q, q);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    p.push(Number(limit), Number(offset));

    const rows  = db.prepare(sql).all(...p);
    const total = db.prepare('SELECT COUNT(*) as c FROM complaints').get().c;

    res.json({ total, data: rows });
  } catch (err) {
    console.error('[GET /api/complaints]', err);
    res.status(500).json({ error: 'Failed to fetch complaints.' });
  }
});

// ── [GET] /api/complaints/:id ────────────────────────────────
// Get one complaint + its activity timeline
app.get('/api/complaints/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    const timeline = db.prepare(
      'SELECT * FROM activity_log WHERE complaint_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);

    res.json({ ...row, timeline });
  } catch (err) {
    console.error('[GET /api/complaints/:id]', err);
    res.status(500).json({ error: 'Failed to fetch complaint.' });
  }
});

// ── [PATCH] /api/complaints/:id/status ──────────────────────
app.patch('/api/complaints/:id/status', (req, res) => {
  try {
    const { status, note = '', actor = 'Admin' } = req.body;
    const allowed = ['New', 'In Progress', 'Resolved', 'Urgent', 'Closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET status=?, updated_at=? WHERE id=?').run(status, now, req.params.id);
    db.prepare('INSERT INTO activity_log (complaint_id,action,actor,note,created_at) VALUES(?,?,?,?,?)')
      .run(req.params.id, `Status → ${status}`, actor, note, now);
    res.json({ success: true, id: req.params.id, status });
  } catch (err) {
    console.error('[PATCH status]', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// ── [PATCH] /api/complaints/:id/assign ──────────────────────
app.patch('/api/complaints/:id/assign', (req, res) => {
  try {
    const { worker } = req.body;
    if (!worker?.trim()) return res.status(400).json({ error: 'Worker name is required.' });
    const now = new Date().toISOString();
    db.prepare('UPDATE complaints SET worker=?, status=?, updated_at=? WHERE id=?')
      .run(worker.trim(), 'In Progress', now, req.params.id);
    db.prepare('INSERT INTO activity_log (complaint_id,action,actor,note,created_at) VALUES(?,?,?,?,?)')
      .run(req.params.id, 'Assigned', 'Admin', `Assigned to ${worker.trim()}`, now);
    res.json({ success: true, id: req.params.id, worker: worker.trim() });
  } catch (err) {
    console.error('[PATCH assign]', err);
    res.status(500).json({ error: 'Failed to assign worker.' });
  }
});

// ── [DELETE] /api/complaints/:id ────────────────────────────
app.delete('/api/complaints/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM complaints WHERE id=?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Complaint not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

// ── [GET] /api/workers ───────────────────────────────────────
app.get('/api/workers', (req, res) => {
  try {
    res.json({ data: db.prepare('SELECT * FROM workers ORDER BY name ASC').all() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workers.' });
  }
});

// ── [POST] /api/workers ──────────────────────────────────────
app.post('/api/workers', (req, res) => {
  try {
    const { name, department, phone } = req.body;
    if (!name?.trim() || !department?.trim()) {
      return res.status(400).json({ error: 'Name and department are required.' });
    }
    const initials = name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    db.prepare(`
      INSERT INTO workers (name,initials,department,phone,status,active_complaints,resolved_total,created_at)
      VALUES (?,?,?,?,'Available',0,0,?)
    `).run(name.trim(), initials, department.trim(), phone?.trim() || null, new Date().toISOString());
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add worker.' });
  }
});

// ── [GET] /api/stats ─────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  try {
    const g = q => db.prepare(q).get();

    const total      = g("SELECT COUNT(*) as c FROM complaints").c;
    const resolved   = g("SELECT COUNT(*) as c FROM complaints WHERE status='Resolved'").c;
    const inprog     = g("SELECT COUNT(*) as c FROM complaints WHERE status='In Progress'").c;
    const urgent     = g("SELECT COUNT(*) as c FROM complaints WHERE status='Urgent'").c;
    const newToday   = g("SELECT COUNT(*) as c FROM complaints WHERE date(created_at)=date('now')").c;
    const unassigned = g("SELECT COUNT(*) as c FROM complaints WHERE worker='Unassigned'").c;

    const byCategory = db.prepare("SELECT type, COUNT(*) as count FROM complaints GROUP BY type ORDER BY count DESC").all();
    const byWard     = db.prepare("SELECT ward, COUNT(*) as count FROM complaints GROUP BY ward ORDER BY ward ASC").all();
    const byStatus   = db.prepare("SELECT status, COUNT(*) as count FROM complaints GROUP BY status").all();
    const last7days  = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM complaints WHERE created_at >= datetime('now','-7 days')
      GROUP BY day ORDER BY day ASC
    `).all();

    res.json({
      total, resolved, inprog, urgent, newToday, unassigned,
      resolutionRate : total > 0 ? Math.round((resolved / total) * 100) : 0,
      byCategory, byWard, byStatus, last7days
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// ── [GET] /api/activity ──────────────────────────────────────
app.get('/api/activity', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const feed = db.prepare(`
      SELECT a.*, c.type, c.emoji, c.ward
      FROM activity_log a
      LEFT JOIN complaints c ON c.id = a.complaint_id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(limit);
    res.json({ data: feed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity.' });
  }
});

// ── 404 catch-all ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ── START SERVER ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  🏙  UrbanFix Server started            ║`);
  console.log(`║  → http://localhost:${PORT}               ║`);
  console.log(`║  → API: http://localhost:${PORT}/api       ║`);
  console.log('╚════════════════════════════════════════╝\n');
});