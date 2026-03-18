# 🏙 UrbanFix — Smart City Complaint Management System

Full-stack web application for citizens to report civic issues and for government officials to manage, assign, and resolve them.

---

## ✅ What was fixed in this version

| Issue | Fix Applied |
|-------|-------------|
| `multer@1.4.5-lts.2` deprecation warning | Upgraded to `multer@^2.0.0` |
| `EBUSY` cleanup warnings on Windows | These are **harmless** Windows file-lock warnings during `npm install` — the packages install correctly. You can safely ignore them. |
| Upload middleware API | Updated `upload.js` to use multer 2.x error codes (`LIMIT_FILE_SIZE`, `INVALID_FILE_TYPE`) |

---

## 📁 Project Structure

```
Smart City Complaint Management System/
├── server.js                  ← Express backend + all API routes
├── package.json               ← Dependencies (multer 2.x)
├── .env.example               ← Copy to .env
│
├── db/
│   └── database.js            ← SQLite schema, auto-create + seed data
│
├── middleware/
│   └── upload.js              ← Multer 2.x photo upload handler
│
├── uploads/                   ← Uploaded complaint photos (auto-created)
│
└── public/                    ← Frontend served as static files
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

---

## 🚀 Setup & Run (Windows / Mac / Linux)

### Step 1 — Install Node.js
Download from **https://nodejs.org** → choose the **LTS** version (v20 recommended)

After installing, verify in PowerShell:
```powershell
node --version   # should show v20.x.x or higher
npm --version    # should show 10.x.x
```

### Step 2 — Install dependencies
Open PowerShell inside the project folder:
```powershell
cd "Smart City Complaint Management System"
npm install
```

> ⚠️ You will see **`npm warn cleanup EBUSY`** messages on Windows.
> These are **normal and harmless** — Windows keeps some files locked temporarily.
> The installation still succeeds. Just scroll to the end and check for:
> `added XX packages` (no `npm error` lines = success ✅)

### Step 3 — Configure environment (optional)
```powershell
copy .env.example .env
```
Default values work out of the box. Edit `.env` only if you want a different port.

### Step 4 — Start the server
```powershell
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║  🏙  UrbanFix Server started            ║
║  → http://localhost:3000               ║
║  → API: http://localhost:3000/api      ║
╚════════════════════════════════════════╝
```

### Step 5 — Open in browser
```
http://localhost:3000
```

The SQLite database (`db/urbanfix.db`) **auto-creates itself** on first run with 10 sample complaints and 6 workers pre-loaded — no manual database setup needed.

---

## 🔌 API Endpoints

### Complaints
```
GET    /api/complaints              List all (supports ?status= ?type= ?ward= ?search= ?limit= ?offset=)
POST   /api/complaints              Submit new complaint (multipart/form-data with optional photo)
GET    /api/complaints/:id          Get single complaint + activity timeline
PATCH  /api/complaints/:id/status   Update status (New / In Progress / Resolved / Urgent / Closed)
PATCH  /api/complaints/:id/assign   Assign a field worker
DELETE /api/complaints/:id          Delete a complaint
```

### Workers
```
GET    /api/workers                 List all field workers
POST   /api/workers                 Add a new worker
PATCH  /api/workers/:id/status      Update availability (Available / Busy / Off Duty)
```

### Dashboard & Activity
```
GET    /api/stats                   Aggregated metrics (totals, by-category, by-ward, last 7 days)
GET    /api/activity                Recent activity feed
```

---

## 📦 POST /api/complaints — Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | text | ✅ | Citizen's full name |
| `contact` | text | ✅ | Phone number or email |
| `ward` | text | ✅ | Select from dropdown |
| `type` | text | ✅ | `Pothole / Road`, `Garbage / Waste`, `Broken Streetlight`, `Water Leakage`, `Other` |
| `description` | text | ✅ | Max 500 characters |
| `priority` | text | — | `Low` / `Medium` (default) / `High` |
| `photo` | file | — | Image only, max 10 MB (JPEG/PNG/WebP) |
| `lat` | number | — | GPS latitude |
| `lng` | number | — | GPS longitude |

---

## 🗄 Database Tables (SQLite — auto-created)

**`complaints`** — stores every citizen report
**`workers`** — stores field worker profiles
**`activity_log`** — full audit trail for every status change and assignment

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Web framework | Express 4.x |
| Database | SQLite via `better-sqlite3` |
| File uploads | Multer 2.x |
| Rate limiting | `express-rate-limit` |
| Frontend | Vanilla HTML + CSS + JS (no framework needed) |

---

## ❓ Common Issues

### "Cannot find module 'better-sqlite3'"
Run `npm install` again. On Windows, `better-sqlite3` requires build tools:
```powershell
npm install --global windows-build-tools
npm install
```
Or use the pre-built version:
```powershell
npm install better-sqlite3 --build-from-source
```

### Port 3000 already in use
Edit `.env` and change `PORT=3001` (or any free port).

### EBUSY warnings during npm install
These are Windows file system warnings — **not errors**. Your install succeeded if you see `added N packages` at the end with no red `npm error` lines.