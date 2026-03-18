// ============================================================
//  db/database.js
//  SQLite database setup using better-sqlite3
//  Creates tables on first run + seeds demo data
// ============================================================

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'urbanfix.db');
const db      = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── CREATE TABLES ───────────────────────────────────────────

db.exec(`
  -- ── Complaints ──────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS complaints (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    contact         TEXT NOT NULL,
    ward            TEXT NOT NULL,
    type            TEXT NOT NULL,
    cat             TEXT NOT NULL,
    emoji           TEXT,
    description     TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'Medium'
                    CHECK(priority IN ('Low','Medium','High')),
    status          TEXT NOT NULL DEFAULT 'New'
                    CHECK(status IN ('New','In Progress','Resolved','Urgent','Closed')),
    department      TEXT,
    worker          TEXT DEFAULT 'Unassigned',
    photo_path      TEXT,
    lat             REAL,
    lng             REAL,
    map_x           INTEGER,
    map_y           INTEGER,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  -- ── Workers ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS workers (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    initials           TEXT NOT NULL,
    department         TEXT NOT NULL,
    phone              TEXT,
    status             TEXT NOT NULL DEFAULT 'Available'
                       CHECK(status IN ('Available','Busy','Off Duty')),
    active_complaints  INTEGER DEFAULT 0,
    resolved_total     INTEGER DEFAULT 0,
    created_at         TEXT NOT NULL
  );

  -- ── Activity Log ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS activity_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id   TEXT NOT NULL,
    action         TEXT NOT NULL,
    actor          TEXT,
    note           TEXT,
    created_at     TEXT NOT NULL,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
  );
`);

// ── SEED DATA (only inserts if tables are empty) ────────────

const existingComplaints = db.prepare('SELECT COUNT(*) as c FROM complaints').get().c;

if (existingComplaints === 0) {
  console.log('🌱  Seeding database with demo data...');

  // Seed workers
  const insertWorker = db.prepare(`
    INSERT INTO workers (name, initials, department, phone, status, active_complaints, resolved_total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seedWorkers = [
    ['Ramesh Kumar',      'RK', 'Public Works Department', '9876543210', 'Busy',      3, 41, '2025-01-10T08:00:00.000Z'],
    ['Suresh Mehta',      'SM', 'Water Supply Board',      '9876543211', 'Busy',      2, 38, '2025-01-10T08:00:00.000Z'],
    ['Priya Lakshmanan',  'PL', 'Public Works Department', '9876543212', 'Busy',      1, 55, '2025-01-12T08:00:00.000Z'],
    ['Kavitha Rao',       'KR', 'Sanitation & Health Dept','9876543213', 'Busy',      2, 29, '2025-01-15T08:00:00.000Z'],
    ['Anil Desai',        'AD', 'DISCOM — Power Dept',     '9876543214', 'Busy',      1, 33, '2025-02-01T08:00:00.000Z'],
    ['Deepa Sharma',      'DS', 'Sanitation & Health Dept','9876543215', 'Available', 0, 47, '2025-02-05T08:00:00.000Z'],
  ];
  for (const w of seedWorkers) insertWorker.run(...w);

  // Seed complaints
  const insertComp = db.prepare(`
    INSERT INTO complaints
      (id, name, contact, ward, type, cat, emoji, description, priority,
       status, department, worker, photo_path, lat, lng, map_x, map_y, created_at, updated_at)
    VALUES
      (@id,@name,@contact,@ward,@type,@cat,@emoji,@description,@priority,
       @status,@department,@worker,@photo_path,@lat,@lng,@map_x,@map_y,@created_at,@updated_at)
  `);

  const seedComplaints = [
    { id:'UF-2025-4892', name:'Arjun Sharma',   contact:'arjun@email.com',  ward:'Ward 2 — North Residential', type:'Pothole / Road',     cat:'road',    emoji:'🛣️', description:'Large pothole near ABC School gate — vehicles swerving dangerously',   priority:'High',   status:'In Progress', department:'Public Works Department',  worker:'Ramesh Kumar',     photo_path:null, lat:18.521, lng:73.855, map_x:308, map_y:198, created_at:'2025-03-14T10:32:00.000Z', updated_at:'2025-03-14T14:10:00.000Z' },
    { id:'UF-2025-4891', name:'Meena Patil',    contact:'meena@email.com',  ward:'Ward 1 — Central Market',    type:'Garbage / Waste',    cat:'garbage', emoji:'🗑️', description:'Garbage overflow at the market — pile not cleared for 3 days',          priority:'High',   status:'Urgent',      department:'Sanitation & Health Dept', worker:'Unassigned',       photo_path:null, lat:18.530, lng:73.842, map_x:108, map_y:395, created_at:'2025-03-14T09:15:00.000Z', updated_at:'2025-03-14T09:15:00.000Z' },
    { id:'UF-2025-4890', name:'Ravi Kulkarni',  contact:'9988776655',       ward:'Ward 5 — South Park',        type:'Water Leakage',      cat:'water',   emoji:'💧', description:'Pipe burst near Block C — road waterlogged, safety hazard',             priority:'High',   status:'In Progress', department:'Water Supply Board',       worker:'Suresh Mehta',     photo_path:null, lat:18.512, lng:73.860, map_x:108, map_y:282, created_at:'2025-03-13T16:45:00.000Z', updated_at:'2025-03-14T08:20:00.000Z' },
    { id:'UF-2025-4889', name:'Sunita Iyer',    contact:'sunita@email.com', ward:'Ward 7 — East Village',      type:'Broken Streetlight', cat:'light',   emoji:'💡', description:'5 consecutive streetlights on Nehru Road out since 2 weeks',           priority:'Medium', status:'New',         department:'DISCOM — Power Dept',      worker:'Unassigned',       photo_path:null, lat:18.498, lng:73.880, map_x:634, map_y:534, created_at:'2025-03-13T11:00:00.000Z', updated_at:'2025-03-13T11:00:00.000Z' },
    { id:'UF-2025-4888', name:'Kiran Desai',    contact:'9876000001',       ward:'Ward 3 — Industrial Zone',   type:'Pothole / Road',     cat:'road',    emoji:'🛣️', description:'Multiple potholes on industrial zone entry road causing traffic',      priority:'Medium', status:'Resolved',    department:'Public Works Department',  worker:'Priya Lakshmanan', photo_path:null, lat:18.525, lng:73.870, map_x:634, map_y:74,  created_at:'2025-03-12T14:00:00.000Z', updated_at:'2025-03-15T17:30:00.000Z' },
    { id:'UF-2025-4887', name:'Anjali Singh',   contact:'anjali@email.com', ward:'Ward 4 — Old Town',          type:'Garbage / Waste',    cat:'garbage', emoji:'🗑️', description:'Illegal dumping behind the central bus stand',                          priority:'Low',    status:'New',         department:'Sanitation & Health Dept', worker:'Unassigned',       photo_path:null, lat:18.535, lng:73.890, map_x:893, map_y:168, created_at:'2025-03-12T09:30:00.000Z', updated_at:'2025-03-12T09:30:00.000Z' },
    { id:'UF-2025-4886', name:'Vijay Nair',     contact:'9876000002',       ward:'Ward 6 — Tech Corridor',     type:'Water Leakage',      cat:'water',   emoji:'💧', description:'Underground pipe leaking — road surface sinking slowly near IT park',  priority:'High',   status:'Urgent',      department:'Water Supply Board',       worker:'Unassigned',       photo_path:null, lat:18.505, lng:73.865, map_x:366, map_y:534, created_at:'2025-03-11T18:00:00.000Z', updated_at:'2025-03-11T18:00:00.000Z' },
    { id:'UF-2025-4885', name:'Priya Joshi',    contact:'priya@email.com',  ward:'Ward 8 — West End',          type:'Broken Streetlight', cat:'light',   emoji:'💡', description:'Streetlight flickering badly — safety concern at night for residents', priority:'Low',    status:'Resolved',    department:'DISCOM — Power Dept',      worker:'Anil Desai',       photo_path:null, lat:18.490, lng:73.895, map_x:893, map_y:492, created_at:'2025-03-11T12:00:00.000Z', updated_at:'2025-03-14T10:00:00.000Z' },
    { id:'UF-2025-4884', name:'Suresh Bhat',    contact:'9876000003',       ward:'Ward 2 — North Residential', type:'Pothole / Road',     cat:'road',    emoji:'🛣️', description:'Deep pothole caused 2 tyre bursts this week — urgent fix needed',     priority:'High',   status:'Urgent',      department:'Public Works Department',  worker:'Unassigned',       photo_path:null, lat:18.522, lng:73.853, map_x:366, map_y:74,  created_at:'2025-03-10T08:15:00.000Z', updated_at:'2025-03-10T08:15:00.000Z' },
    { id:'UF-2025-4883', name:'Kavita Reddy',   contact:'kavita@email.com', ward:'Ward 5 — South Park',        type:'Garbage / Waste',    cat:'garbage', emoji:'🗑️', description:'Overflowing bins near playground — unhygienic, children play nearby', priority:'Medium', status:'In Progress', department:'Sanitation & Health Dept', worker:'Kavitha Rao',      photo_path:null, lat:18.510, lng:73.862, map_x:108, map_y:534, created_at:'2025-03-10T07:00:00.000Z', updated_at:'2025-03-11T09:00:00.000Z' },
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insertComp.run(item);
  });
  insertMany(seedComplaints);

  // Seed activity log
  const insertLog = db.prepare(`
    INSERT INTO activity_log (complaint_id, action, actor, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const seedLogs = [
    ['UF-2025-4892', 'Submitted',       'Arjun Sharma',   'Complaint registered and routed to department',     '2025-03-14T10:32:00.000Z'],
    ['UF-2025-4892', 'Status → In Progress', 'System',   'Auto-routed to Public Works Department',            '2025-03-14T10:33:00.000Z'],
    ['UF-2025-4892', 'Assigned',        'Admin',          'Assigned to Ramesh Kumar',                          '2025-03-14T14:10:00.000Z'],
    ['UF-2025-4890', 'Submitted',       'Ravi Kulkarni',  'Complaint registered and routed to department',     '2025-03-13T16:45:00.000Z'],
    ['UF-2025-4890', 'Assigned',        'Admin',          'Assigned to Suresh Mehta',                          '2025-03-14T08:20:00.000Z'],
    ['UF-2025-4888', 'Submitted',       'Kiran Desai',    'Complaint registered and routed to department',     '2025-03-12T14:00:00.000Z'],
    ['UF-2025-4888', 'Status → Resolved','Priya Lakshmanan','Road repair completed and verified by inspector', '2025-03-15T17:30:00.000Z'],
  ];
  for (const log of seedLogs) insertLog.run(...log);

  console.log('✅  Seed complete — 10 complaints, 6 workers, activity logs inserted.');
}

module.exports = db;
