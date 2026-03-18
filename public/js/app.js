/* ============================================================
   UrbanFix — Smart City Complaint Management System
   app.js  — Frontend JavaScript (connects to Node.js backend)
   ============================================================ */

'use strict';

const API = '/api'; // Base URL for backend

// ── GLOBAL STATE ────────────────────────────────────────────
const State = {
  complaints : [],
  workers    : [],
  stats      : {},
  currentFilter : { search: '', status: '', type: '' }
};

// ── UTILITIES ───────────────────────────────────────────────
function $(id)   { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function showSpinner(msg = 'Loading…') {
  $('spinner-overlay').classList.add('on');
  $('spinner-text').textContent = msg;
}
function hideSpinner() {
  $('spinner-overlay').classList.remove('on');
}

function toast(title, sub = '') {
  $('ttico').textContent = title.slice(0, 2);
  $('ttt').textContent   = title.replace(/^.{0,3}/, '').trim() || title;
  $('tts').textContent   = sub;
  const el = $('tst');
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 3600);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Status pill HTML
const PMAP = { New: 'pnew', 'In Progress': 'pprog', Resolved: 'pres', Urgent: 'purg', Closed: 'pprog' };
function pill(s) { return `<span class="pill ${PMAP[s] || 'pnew'}">${s}</span>`; }

// Category type-dot HTML
const CAT_COLORS = { road: 'var(--blue)', water: 'var(--cyan)', light: 'var(--amber)', garbage: 'var(--green)', other: 'var(--text3)' };
function tdot(cat) { return `<span class="tdot" style="background:${CAT_COLORS[cat] || '#999'}"></span>`; }

// ── FETCH HELPERS ────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(API + url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`[API ${url}]`, e);
    throw e;
  }
}

// ── PAGE SWITCHING ───────────────────────────────────────────
function sw(v) {
  $$('.page').forEach(p => p.classList.remove('on'));
  $$('.tab').forEach(t => t.classList.remove('on'));
  $(v + '-page').classList.add('on');
  $$('.tab')[['citizen', 'govt', 'map'].indexOf(v)].classList.add('on');
  if (v === 'govt') loadGovtDashboard();
  if (v === 'map')  loadMapPage();
}

// ── GOVERNMENT SECTION SWITCH ────────────────────────────────
function switchSec(s, el) {
  $$('.gsec').forEach(x  => x.classList.remove('on'));
  $$('.gsitem').forEach(x => x.classList.remove('on'));
  $('sec-' + s).classList.add('on');
  if (el) el.classList.add('on');
}

// ════════════════════════════════════════════════════════════
//  CITIZEN PAGE
// ════════════════════════════════════════════════════════════

// Issue type selection
function pickType(el) {
  $$('.icard').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  $('ft').value = el.dataset.t;
}

// Priority selection
let cprio = 'pm';
function setPrio(el, p) {
  $$('.popt').forEach(b => { b.className = 'popt'; });
  el.classList.add(p);
  cprio = p;
}

// Photo upload simulation (real file attached via FormData)
function doUpload() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumbs = $('pthumbs');
      const first  = thumbs.querySelector('.thumb');
      first.innerHTML = `<img src="${e.target.result}" alt="preview">`;
      thumbs.classList.add('show');
    };
    reader.readAsDataURL(file);

    // Store file for form submission
    State.uploadedFile = file;

    const drop = $('pdrop');
    drop.classList.add('ok');
    $('pdico').textContent = '✅';
    $('pdtxt').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) ready`;
    toast('📷 Photo ready', 'Will be uploaded with your report');
  };
  input.click();
}

// Location pin on mini-map
let pinnedCoords = { lat: null, lng: null };
function pinLoc(el) {
  const svg = el.querySelector('svg');
  const px  = Math.random() * 400 + 80;
  const py  = Math.random() * 80  + 40;
  const pt  = svg.getElementById('lpint');
  const pc  = svg.getElementById('lpin');
  pt.setAttribute('x', px); pt.setAttribute('y', py); pt.setAttribute('opacity', '1');
  pc.setAttribute('cx', px); pc.setAttribute('cy', py); pc.setAttribute('r', '14'); pc.setAttribute('opacity', '0.2');
  $('lloc').textContent = '📍 Location pinned — coordinates saved';
  el.style.borderColor = 'var(--green)';

  // Simulate GPS coords (in a real app, use navigator.geolocation)
  pinnedCoords = {
    lat: 18.5 + (Math.random() * 0.05),
    lng: 73.8 + (Math.random() * 0.05)
  };
  toast('📍 Location pinned', 'GPS coordinates saved to report');
}

// ── SUBMIT COMPLAINT ─────────────────────────────────────────
async function doSubmit() {
  const name  = $('fn').value.trim();
  const cont  = $('fc').value.trim();
  const ward  = $('fw').value;
  const type  = $('ft').value;
  const desc  = $('fd').value.trim();

  if (!name || !cont || !ward || !type || !desc) {
    toast('⚠️ Missing fields', 'Please fill all required fields');
    return;
  }
  if (desc.length > 500) {
    toast('⚠️ Too long', 'Description must be under 500 characters');
    return;
  }

  const btn = document.querySelector('.sbtn');
  btn.disabled = true;
  btn.textContent = '⏳ Submitting…';

  try {
    const formData = new FormData();
    formData.append('name',        name);
    formData.append('contact',     cont);
    formData.append('ward',        ward);
    formData.append('type',        type);
    formData.append('description', desc);
    formData.append('priority',    cprio === 'ph' ? 'High' : cprio === 'pl' ? 'Low' : 'Medium');
    formData.append('lat',         pinnedCoords.lat || '');
    formData.append('lng',         pinnedCoords.lng || '');
    if (State.uploadedFile) formData.append('photo', State.uploadedFile);

    const result = await fetch(API + '/complaints', { method: 'POST', body: formData });
    const data   = await result.json();

    if (!result.ok) throw new Error(data.error || 'Submission failed');

    // Show success modal
    $('modid').textContent   = data.id;
    $('moddept').textContent = data.department;
    $('modbg').classList.add('on');

    // Update hero counter
    const el = $('hs1');
    el.textContent = (parseInt(el.textContent.replace(/,/g, '')) + 1).toLocaleString();

    // Reset form
    $('fn').value = ''; $('fc').value = ''; $('fw').value = ''; $('fd').value = '';
    State.uploadedFile = null;
    $$('.popt').forEach(b => b.className = 'popt');
    document.querySelector('.popt:nth-child(2)').classList.add('pm');
    $('pdrop').classList.remove('ok');
    $('pdico').textContent = '📸';
    $('pdtxt').textContent = 'Click to upload photo evidence';
    $('pthumbs').classList.remove('show');

    // Refresh recent list
    loadRecentComplaints();

  } catch (err) {
    toast('❌ Error', err.message || 'Submission failed. Try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Submit to Municipal System';
  }
}

// ── LOAD RECENT COMPLAINTS ───────────────────────────────────
async function loadRecentComplaints() {
  try {
    const data = await apiFetch('/complaints?limit=3');
    const list = data.data || [];

    const bgMap = {
      road   : 'rgba(37,99,235,.1)',
      water  : 'rgba(8,145,178,.1)',
      light  : 'rgba(217,119,6,.1)',
      garbage: 'rgba(22,163,74,.1)',
      other  : 'rgba(83,83,83,.1)'
    };

    $('rlist').innerHTML = list.map(c => `
      <div class="ritem" onclick="toast('📋 ${c.id}','${c.ward}')">
        <div class="rico" style="background:${bgMap[c.cat] || bgMap.other}">${c.emoji}</div>
        <div class="rbody">
          <div class="rtitle">${c.description.slice(0, 44)}…</div>
          <div class="rmeta">${c.ward} · ${fmtDate(c.created_at)}</div>
        </div>
        ${pill(c.status)}
      </div>`).join('') || '<div style="color:var(--text3);font-size:13px;padding:8px">No recent reports yet.</div>';

  } catch {
    $('rlist').innerHTML = '<div style="color:var(--text3);font-size:13px">Could not load recent reports.</div>';
  }
}

// ── LOAD STATS ───────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await apiFetch('/stats');
    State.stats = s;

    // Update hero counters
    animN($('hs1'), s.total);
    animN($('hs2'), s.resolved);

    // Update issue type card counts
    const typeMap = { 'Pothole / Road': 0, 'Garbage / Waste': 0, 'Broken Streetlight': 0, 'Water Leakage': 0 };
    (s.byCategory || []).forEach(c => {
      if (typeMap[c.type] !== undefined) typeMap[c.type] = c.count;
    });
    $$('.icard').forEach(card => {
      const t = card.dataset.t;
      const cnt = card.querySelector('.icnt');
      if (cnt && typeMap[t] !== undefined) cnt.textContent = `${typeMap[t]} open cases`;
    });
  } catch {
    console.warn('Could not load stats');
  }
}

// ═══════════════════════════════════════════════════════════
//  GOVERNMENT DASHBOARD
// ═══════════════════════════════════════════════════════════

async function loadGovtDashboard() {
  showSpinner('Loading dashboard…');
  try {
    const [statsData, complData, workData] = await Promise.all([
      apiFetch('/stats'),
      apiFetch('/complaints?limit=100'),
      apiFetch('/workers')
    ]);
    State.stats      = statsData;
    State.complaints = complData.data || [];
    State.workers    = workData.data  || [];

    buildMetricCards(statsData);
    buildCatChart(statsData.byCategory || []);
    buildDonutChart(statsData);
    buildQTable();
    buildMTable(State.complaints);
    buildWorkers();
    buildUTable();
    buildAnalytics(statsData);

    // Update unassigned badge
    $('nbadge').textContent = statsData.unassigned || 0;
  } catch (err) {
    toast('❌ Dashboard error', err.message);
  } finally {
    hideSpinner();
  }
}

// Metric cards
function buildMetricCards(s) {
  const metrics = [
    { ico:'📋', bg:'rgba(37,99,235,.1)', delta:`+${s.newToday} today`, dclass:'dup', val: s.total,    lbl:'Total Complaints'    },
    { ico:'✅', bg:'rgba(22,163,74,.1)',  delta:`${s.resolutionRate}%`,  dclass:'dup', val: s.resolved, lbl:'Resolved',    col:'var(--green)' },
    { ico:'⏳', bg:'rgba(217,119,6,.1)',  delta:'Active',                dclass:'dne', val: s.inprog,   lbl:'In Progress', col:'var(--amber)' },
    { ico:'🚨', bg:'rgba(220,38,38,.1)',  delta:'Action needed',         dclass:'ddn', val: s.urgent,   lbl:'Urgent Unassigned', col:'var(--red)' },
  ];
  $('mgrid').innerHTML = metrics.map(m => `
    <div class="mc">
      <div class="mctop">
        <div class="mico" style="background:${m.bg}">${m.ico}</div>
        <div class="mdelta ${m.dclass}">${m.delta}</div>
      </div>
      <div class="mval" ${m.col ? `style="color:${m.col}"` : ''}>${m.val.toLocaleString()}</div>
      <div class="mlbl">${m.lbl}</div>
    </div>`).join('');
}

// Category bar chart
function buildCatChart(cats) {
  const max = Math.max(...cats.map(c => c.count), 1);
  const emojiMap = { 'Pothole / Road': '🛣️', 'Garbage / Waste': '🗑️', 'Broken Streetlight': '💡', 'Water Leakage': '💧', 'Other': '📋' };
  const colorMap = { 'Pothole / Road': 'var(--blue)', 'Garbage / Waste': 'var(--green)', 'Broken Streetlight': 'var(--amber)', 'Water Leakage': 'var(--cyan)', 'Other': 'var(--text3)' };

  $('catcg').innerHTML = cats.map(c => `
    <div class="brow">
      <div class="blbl">${emojiMap[c.type] || '📋'} ${c.type.split(' ')[0]}</div>
      <div class="btrack"><div class="bfill" style="width:0%;background:${colorMap[c.type]||'var(--text3)'}" data-w="${Math.round((c.count/max)*100)}"></div></div>
      <div class="bcnt">${c.count}</div>
    </div>`).join('');
  setTimeout(() => $$('.bfill[data-w]').forEach(b => b.style.width = b.dataset.w + '%'), 80);
}

// Donut chart (SVG is in HTML, just update the legend)
function buildDonutChart(s) {
  const total = s.total || 1;
  const rPct  = Math.round(s.resolved / total * 100);
  const iPct  = Math.round(s.inprog   / total * 100);
  const uPct  = 100 - rPct - iPct;

  // Update the SVG circle dashoffsets dynamically
  const circ = 2 * Math.PI * 44; // r=44
  const rDash = circ * rPct / 100;
  const iDash = circ * iPct / 100;
  const uDash = circ * uPct / 100;

  const svg = document.querySelector('#sec-overview .donut-row svg');
  if (!svg) return;
  const circles = svg.querySelectorAll('circle');
  if (circles[1]) { circles[1].setAttribute('stroke-dasharray', `${rDash.toFixed(1)} ${circ}`); circles[1].setAttribute('stroke-dashoffset', '0'); }
  if (circles[2]) { circles[2].setAttribute('stroke-dasharray', `${iDash.toFixed(1)} ${circ}`); circles[2].setAttribute('stroke-dashoffset', `-${rDash.toFixed(1)}`); }
  if (circles[3]) { circles[3].setAttribute('stroke-dasharray', `${uDash.toFixed(1)} ${circ}`); circles[3].setAttribute('stroke-dashoffset', `-${(rDash+iDash).toFixed(1)}`); }

  // Update center text
  const texts = svg.querySelectorAll('text');
  if (texts[0]) texts[0].textContent = rPct + '%';

  // Update legend
  const dleg = document.querySelector('#sec-overview .dleg');
  if (dleg) {
    dleg.innerHTML = `
      <div class="dli"><div class="dldot" style="background:var(--green)"></div>Resolved<span class="dlpct">${rPct}%</span></div>
      <div class="dli"><div class="dldot" style="background:var(--amber)"></div>In Progress<span class="dlpct">${iPct}%</span></div>
      <div class="dli"><div class="dldot" style="background:var(--red)"></div>Other<span class="dlpct">${uPct}%</span></div>`;
  }
}

// Build table HTML
function mkTable(list, lim) {
  const rows = (lim ? list.slice(0, lim) : list).map(c => `
    <tr onclick="toast('📋 ${c.id}','${(c.description||'').slice(0,50)}…')">
      <td><span class="tdid">${c.id}</span></td>
      <td><div class="tdtype">${tdot(c.cat)}${c.type}</div></td>
      <td style="font-size:12px;color:var(--text2)">${c.ward.split('—')[0].trim()}</td>
      <td>${pill(c.status)}</td>
      <td><span class="pill ${c.priority==='High'?'purg':c.priority==='Medium'?'pprog':'pres'}">${c.priority}</span></td>
      <td style="font-size:12px;color:var(--text2)">${c.worker || 'Unassigned'}</td>
      <td>
        <div class="tdphoto">
          ${c.photo_path ? `<img src="${c.photo_path}" alt="photo">` : (c.emoji || '—')}
        </div>
      </td>
      <td style="font-size:12px;color:var(--text3)">${fmtDate(c.created_at)}</td>
      <td>
        <div class="tdact">
          <button class="abtn" onclick="event.stopPropagation();assignWorker('${c.id}')">Assign</button>
          <button class="abtn res" onclick="event.stopPropagation();resolveComplaint('${c.id}',this)">✓ Resolve</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <table>
      <thead><tr>
        <th>ID</th><th>Type</th><th>Ward</th><th>Status</th>
        <th>Priority</th><th>Assigned To</th><th>Photo</th><th>Date</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:28px">No complaints found.</td></tr>`}</tbody>
    </table>`;
}

function buildQTable()           { $('qtable').innerHTML = mkTable(State.complaints, 5); }
function buildMTable(list)       { $('mtable').innerHTML = mkTable(list); }

// Filter table
function filt() {
  const q  = $('tsearch').value.toLowerCase();
  const st = $('fstat').value;
  const ty = $('ftype').value;
  const filtered = State.complaints.filter(c => {
    const mq = !q || (c.id + c.type + c.ward + c.description).toLowerCase().includes(q);
    const ms = !st || c.status === st;
    const mt = !ty || c.type.includes(ty);
    return mq && ms && mt;
  });
  buildMTable(filtered);
}

// Assign worker
async function assignWorker(id) {
  const name = prompt('Enter worker name to assign:');
  if (!name?.trim()) return;
  try {
    await apiFetch(`/complaints/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker: name.trim() })
    });
    toast('👷 Worker assigned', `${name} assigned to ${id}`);
    await loadGovtDashboard();
  } catch (err) {
    toast('❌ Error', err.message);
  }
}

// Resolve complaint
async function resolveComplaint(id, btn) {
  try {
    await apiFetch(`/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Resolved', actor: 'Admin', note: 'Marked resolved from dashboard' })
    });
    toast('✅ Resolved!', `${id} marked as resolved`);
    btn.closest('tr').querySelectorAll('.pill').forEach(p => { p.className = 'pill pres'; p.textContent = 'Resolved'; });
    await loadGovtDashboard();
  } catch (err) {
    toast('❌ Error', err.message);
  }
}

// Build worker cards
function buildWorkers() {
  $('wgrid').innerHTML = State.workers.map(w => `
    <div class="wcard" onclick="toast('👷 ${w.name}','${w.department}')">
      <div class="wava">${w.initials}</div>
      <div class="wbody">
        <div class="wname">${w.name} <span class="avail ${w.status==='Available'?'ayes':'abusy'}"></span></div>
        <div class="wdept">${w.department}</div>
        <div class="wstats">
          <div><div class="wsv" style="color:${w.status==='Available'?'var(--green)':'var(--amber)'}">${w.active_complaints}</div><div class="wsl">Active</div></div>
          <div><div class="wsv">${w.resolved_total}</div><div class="wsl">Resolved</div></div>
          <div><div class="wsv" style="color:${w.status==='Available'?'var(--green)':'var(--amber)'}">${w.status}</div><div class="wsl">Status</div></div>
        </div>
      </div>
    </div>`).join('');
}

function buildUTable() {
  $('utable').innerHTML = mkTable(State.complaints.filter(c => c.worker === 'Unassigned'));
}

// Analytics section
function buildAnalytics(s) {
  // Ward chart
  const wards = s.byWard || [];
  const maxW   = Math.max(...wards.map(w => w.count), 1);
  $('wardch').innerHTML = `<div class="barchart">${wards.map(w => `
    <div class="brow">
      <div class="blbl">${w.ward.split('—')[0].trim()}</div>
      <div class="btrack"><div class="bfill" style="width:0%;background:var(--blue)" data-w="${Math.round(w.count/maxW*100)}"></div></div>
      <div class="bcnt">${w.count}</div>
    </div>`).join('')}</div>`;

  // Weekly volume chart
  const days7 = s.last7days || [];
  const maxV  = Math.max(...days7.map(d => d.count), 1);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  $('weekch').innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:7px;height:110px;padding-top:6px">
      ${days7.map((d, i) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:10px;color:var(--text3)">${d.count}</div>
          <div style="width:100%;background:${i===days7.length-1?'var(--blue)':'rgba(37,99,235,.35)'};border-radius:5px 5px 0 0;height:${(d.count/maxV)*82}px"></div>
          <div style="font-size:10px;color:var(--text3)">${dayNames[new Date(d.day).getDay()]}</div>
        </div>`).join('')}
    </div>`;

  setTimeout(() => $$('.bfill[data-w]').forEach(b => b.style.width = b.dataset.w + '%'), 80);
}

// ═══════════════════════════════════════════════════════════
//  MAP PAGE
// ═══════════════════════════════════════════════════════════

const CAT_HEX = { road:'#2563eb', water:'#0891b2', light:'#d97706', garbage:'#16a34a', other:'#6b7280' };

async function loadMapPage() {
  try {
    const data = await apiFetch('/complaints?limit=100');
    State.complaints = data.data || [];
    buildMap(State.complaints);
  } catch (err) {
    toast('❌ Map error', err.message);
  }
}

function buildMap(list) {
  const svg = $('cmap');
  $$('.cpin').forEach(p => p.remove());

  list.forEach((c, i) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.className.baseVal = 'cpin';
    g.dataset.cat = c.cat;
    g.dataset.urg = c.status === 'Urgent' ? '1' : '0';
    g.setAttribute('transform', `translate(${c.map_x || 500},${c.map_y || 321})`);

    const fc = c.status === 'Urgent' ? '#dc2626' : (CAT_HEX[c.cat] || '#666');
    g.innerHTML = `
      <circle r="18" fill="${fc}" opacity="0.18"/>
      ${c.status === 'Urgent' ? `
        <circle r="22" fill="none" stroke="${fc}" stroke-width="1.5" opacity="0.35">
          <animate attributeName="r" values="18;30;18" dur="2.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite"/>
        </circle>` : ''}
      <circle r="10" fill="${fc}"/>
      <text y="4" text-anchor="middle" font-size="11" fill="#fff" style="pointer-events:none">${c.emoji || '📋'}</text>`;
    g.style.cursor = 'pointer';
    g.addEventListener('click', e => showMapPopup(c, e));
    svg.appendChild(g);
  });

  // Sidebar list
  $('mclist').innerHTML = list.map((c, i) => `
    <div class="mcitem" id="mi${i}" onclick="hlPin(${i})">
      <div class="mcitop">
        <div class="mcitype">${c.emoji || '📋'} ${c.type}</div>
        ${pill(c.status)}
      </div>
      <div class="mcimeta">${c.ward.split('—')[0].trim()} · ${fmtDate(c.created_at)}</div>
      <div class="mcidesc">${(c.description || '').slice(0, 72)}…</div>
      ${c.photo_path ? `<div class="mphoto"><img src="${c.photo_path}" alt="photo"></div>` : `<div class="mphoto">${c.emoji}</div>`}
    </div>`).join('');
}

function showMapPopup(c, e) {
  const pop    = $('mpopup');
  const canvas = $('mcanvas');
  const rect   = canvas.getBoundingClientRect();
  const sx = rect.width / 1000, sy = rect.height / 642;
  let px = (c.map_x || 500) * sx + 12;
  let py = (c.map_y || 321) * sy - 95;
  if (px + 220 > rect.width) px = (c.map_x || 500) * sx - 230;
  if (py < 0) py = (c.map_y || 321) * sy + 22;
  pop.style.left = px + 'px';
  pop.style.top  = py + 'px';
  pop.innerHTML = `
    <div class="mptitle">${c.emoji} ${c.type}</div>
    <div class="mpmeta">${c.ward.split('—')[0].trim()} · ${pill(c.status)} · ${c.priority} priority</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:7px">${(c.description||'').slice(0,80)}…</div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:7px">👷 ${c.worker || 'Unassigned'} · ${fmtDate(c.created_at)}</div>
    ${c.photo_path ? `<div class="mpphoto"><img src="${c.photo_path}" alt="photo"></div>` : `<div class="mpphoto">${c.emoji}</div>`}
    <div style="margin-top:9px;font-size:10px;font-family:monospace;color:var(--text3)">${c.id}</div>`;
  pop.classList.add('on');
  clearTimeout(pop._t);
  pop._t = setTimeout(() => pop.classList.remove('on'), 4500);
}

function hlPin(i) {
  $$('.mcitem').forEach(el => el.classList.remove('on'));
  $('mi' + i).classList.add('on');
}

function mfilt(f, el) {
  $$('.mfc').forEach(c => { c.classList.remove('on','fall','froad','fwater','flight','fgarbage','furgent'); });
  el.classList.add('on', 'f' + f);
  $$('.cpin').forEach(p => {
    p.style.opacity = f === 'all' ? '1' : f === 'urgent' ? (p.dataset.urg === '1' ? '1' : '0.1') : (p.dataset.cat === f ? '1' : '0.1');
  });
  $$('.mcitem').forEach((el, i) => {
    const c = State.complaints[i];
    el.style.display = f === 'all' ? '' : (f === 'urgent' ? (c.status === 'Urgent' ? '' : 'none') : (c.cat === f ? '' : 'none'));
  });
}

// ── COUNTER ANIMATION ────────────────────────────────────────
function animN(el, target) {
  if (!el) return;
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / 1500, 1);
    const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = v > 999 ? Number(v).toLocaleString() : v;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = Number(target).toLocaleString();
  })(t0);
}

// ── SCROLL REVEAL ────────────────────────────────────────────
const ro = new IntersectionObserver(
  es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('vis'); }),
  { threshold: 0.09 }
);
document.querySelectorAll('.rv').forEach(el => ro.observe(el));

// ── LIVE TICKER ──────────────────────────────────────────────
const TICKS = [
  '🛣️ Pothole reported in Ward 4',
  '💧 Water leakage near Park Ave',
  '🗑️ Garbage overflow at junction',
  '💡 Streetlight down — South Road'
];
let ti = 0;
setInterval(async () => {
  if (Math.random() > 0.4) {
    toast('🔔 New Report', TICKS[ti++ % TICKS.length]);
    // Refresh counter from live DB
    try {
      const s = await apiFetch('/stats');
      const el = $('hs1');
      if (el) el.textContent = Number(s.total).toLocaleString();
    } catch {}
  }
}, 14000);

// ── INIT ─────────────────────────────────────────────────────
(async function init() {
  await Promise.allSettled([
    loadStats(),
    loadRecentComplaints()
  ]);
})();
