/**
 * TEMPT Token API Server
 * - Email subscriber collection
 * - ETH → Solana migration registration
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3031;
const DATA_DIR = path.join(__dirname, 'data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
const MIGRATIONS_FILE = path.join(DATA_DIR, 'migrations.json');
const ADMIN_KEY = process.env.TEMPT_ADMIN_KEY || 'tempt-admin-2026';

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SUBSCRIBERS_FILE)) fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
if (!fs.existsSync(MIGRATIONS_FILE)) fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify({ registrations: [] }, null, 2));

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return {}; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidEth(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidSol(addr) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  });
  res.end(body);
}

function getIP(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    });
    return res.end();
  }

  // ── POST /api/subscribe ───────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/subscribe') {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const source = (body.source || 'website').trim().substring(0, 50);
      const name = (body.name || '').trim().substring(0, 100);

      if (!email || !isValidEmail(email))
        return json(res, 400, { success: false, message: 'Invalid email address.' });

      const data = loadJSON(SUBSCRIBERS_FILE);
      if (!data.subscribers) data.subscribers = [];
      const existing = data.subscribers.find(s => s.email === email);

      if (existing)
        return json(res, 200, { success: true, message: 'Already subscribed!', duplicate: true });

      data.subscribers.push({
        id: crypto.randomBytes(8).toString('hex'),
        email, name: name || null, source,
        subscribedAt: new Date().toISOString(),
        ip: getIP(req),
      });

      saveJSON(SUBSCRIBERS_FILE, data);
      console.log(`[sub] ${email} (${source})`);
      return json(res, 200, { success: true, message: "You're on the list! We'll notify you at launch." });

    } catch (err) {
      console.error('Subscribe error:', err);
      return json(res, 500, { success: false, message: 'Server error. Please try again.' });
    }
  }

  // ── POST /api/migrate ─────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/migrate') {
    try {
      const body = await parseBody(req);
      const ethAddress = (body.ethAddress || '').trim();
      const solAddress = (body.solAddress || '').trim();
      const email = (body.email || '').trim().toLowerCase() || null;
      const balance = body.balance ? String(body.balance).trim() : null;

      if (!isValidEth(ethAddress))
        return json(res, 400, { success: false, message: 'Invalid Ethereum address.' });

      if (!isValidSol(solAddress))
        return json(res, 400, { success: false, message: 'Invalid Solana address.' });

      const data = loadJSON(MIGRATIONS_FILE);
      if (!data.registrations) data.registrations = [];

      const existing = data.registrations.find(
        r => r.ethAddress.toLowerCase() === ethAddress.toLowerCase()
      );

      if (existing) {
        // Update Solana address if changed
        if (existing.solAddress !== solAddress) {
          existing.solAddress = solAddress;
          existing.updatedAt = new Date().toISOString();
          saveJSON(MIGRATIONS_FILE, data);
          return json(res, 200, { success: true, message: 'Your Solana address has been updated.', duplicate: true });
        }
        return json(res, 200, { success: true, message: 'Already registered — you\'re in the airdrop!', duplicate: true });
      }

      data.registrations.push({
        id: crypto.randomBytes(8).toString('hex'),
        ethAddress: ethAddress.toLowerCase(),
        solAddress,
        email,
        selfReportedBalance: balance,
        status: 'pending',          // pending | verified | airdropped
        registeredAt: new Date().toISOString(),
        ip: getIP(req),
      });

      saveJSON(MIGRATIONS_FILE, data);
      console.log(`[migrate] ETH: ${ethAddress} → SOL: ${solAddress}`);
      return json(res, 200, { success: true, message: 'Registration recorded! You\'ll receive your TMPT on Solana at launch.' });

    } catch (err) {
      console.error('Migrate error:', err);
      return json(res, 500, { success: false, message: 'Server error. Please try again.' });
    }
  }

  // ── Admin: GET /api/admin/subscribers ────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/admin/subscribers') {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const data = loadJSON(SUBSCRIBERS_FILE);
    return json(res, 200, { success: true, count: (data.subscribers || []).length, subscribers: data.subscribers || [] });
  }

  // ── Admin: DELETE /api/admin/subscribers/:email ───────────────────────────
  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/subscribers/')) {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const emailToDelete = decodeURIComponent(pathname.split('/').pop()).toLowerCase();
    const data = loadJSON(SUBSCRIBERS_FILE);
    const before = (data.subscribers || []).length;
    data.subscribers = (data.subscribers || []).filter(s => s.email !== emailToDelete);

    if (data.subscribers.length === before)
      return json(res, 404, { success: false, message: 'Subscriber not found' });

    saveJSON(SUBSCRIBERS_FILE, data);
    return json(res, 200, { success: true, message: `Removed ${emailToDelete}` });
  }

  // ── Admin: GET /api/admin/migrations ─────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/admin/migrations') {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const data = loadJSON(MIGRATIONS_FILE);
    const regs = data.registrations || [];
    return json(res, 200, {
      success: true,
      count: regs.length,
      pending: regs.filter(r => r.status === 'pending').length,
      verified: regs.filter(r => r.status === 'verified').length,
      airdropped: regs.filter(r => r.status === 'airdropped').length,
      registrations: regs,
    });
  }

  // ── Admin: PATCH /api/admin/migrations/:id ────────────────────────────────
  if (req.method === 'PATCH' && pathname.startsWith('/api/admin/migrations/')) {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const id = pathname.split('/').pop();
    const body = await parseBody(req);
    const data = loadJSON(MIGRATIONS_FILE);
    const reg = (data.registrations || []).find(r => r.id === id);

    if (!reg) return json(res, 404, { success: false, message: 'Not found' });

    if (body.status) reg.status = body.status;
    if (body.verifiedBalance !== undefined) reg.verifiedBalance = body.verifiedBalance;
    if (body.txHash) reg.txHash = body.txHash;
    reg.updatedAt = new Date().toISOString();

    saveJSON(MIGRATIONS_FILE, data);
    return json(res, 200, { success: true, registration: reg });
  }

  // ── Health check ──────────────────────────────────────────────────────────
  if (pathname === '/api/health') {
    const subs = loadJSON(SUBSCRIBERS_FILE);
    const migs = loadJSON(MIGRATIONS_FILE);
    return json(res, 200, {
      status: 'ok',
      subscribers: (subs.subscribers || []).length,
      migrations: (migs.registrations || []).length,
      ts: new Date().toISOString(),
    });
  }

  return json(res, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TEMPT Token API listening on port ${PORT}`);
});
