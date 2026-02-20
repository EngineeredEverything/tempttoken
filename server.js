/**
 * TEMPT Token API Server
 * - Email subscriber collection
 * - ETH → Solana migration registration
 * - Privacy-first page view analytics (no cookies, no fingerprinting)
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

const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
const WAITLIST_FILE  = path.join(DATA_DIR, 'waitlist.json');

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SUBSCRIBERS_FILE)) fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
if (!fs.existsSync(MIGRATIONS_FILE)) fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify({ registrations: [] }, null, 2));
if (!fs.existsSync(ANALYTICS_FILE)) fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ pageviews: [] }, null, 2));
if (!fs.existsSync(WAITLIST_FILE))  fs.writeFileSync(WAITLIST_FILE,  JSON.stringify({ members: [] }, null, 2));

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

  // ── POST /api/pageview ────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/pageview') {
    try {
      const body = await parseBody(req);
      const page     = (body.page || '/').trim().substring(0, 100);
      const referrer = (body.referrer || '').trim().substring(0, 200);
      const ua       = req.headers['user-agent'] || '';

      // Skip obvious bots
      if (/bot|crawler|spider|crawl|fetch|scraper|headless|lighthouse/i.test(ua))
        return json(res, 204, {});

      const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';

      let refSource = 'direct';
      if (referrer) {
        if (/twitter\.com|t\.co/i.test(referrer))   refSource = 'twitter';
        else if (/t\.me|telegram/i.test(referrer))  refSource = 'telegram';
        else if (/google\./i.test(referrer))         refSource = 'google';
        else if (/discord/i.test(referrer))          refSource = 'discord';
        else if (/reddit/i.test(referrer))           refSource = 'reddit';
        else                                          refSource = 'other';
      }

      const data = loadJSON(ANALYTICS_FILE);
      if (!data.pageviews) data.pageviews = [];
      if (data.pageviews.length >= 10000) data.pageviews = data.pageviews.slice(-9000);

      data.pageviews.push({ ts: new Date().toISOString(), page, ref: refSource, device });
      saveJSON(ANALYTICS_FILE, data);
      return json(res, 200, { success: true });
    } catch { return json(res, 500, { success: false }); }
  }

  // ── GET /api/admin/analytics ──────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/admin/analytics') {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const data  = loadJSON(ANALYTICS_FILE);
    const views = data.pageviews || [];
    const days  = parseInt(url.searchParams.get('days') || '7');
    const since = new Date(Date.now() - days * 86400000);
    const recent = views.filter(v => new Date(v.ts) >= since);

    const byPage = {}, byRef = {}, byDevice = {}, byDay = {};
    for (const v of recent) {
      byPage[v.page]     = (byPage[v.page]     || 0) + 1;
      byRef[v.ref]       = (byRef[v.ref]       || 0) + 1;
      byDevice[v.device] = (byDevice[v.device] || 0) + 1;
      const day = v.ts.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return json(res, 200, {
      success: true,
      period: `last ${days} days`,
      total: recent.length,
      allTime: views.length,
      topPages: Object.entries(byPage).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([page,count])=>({page,count})),
      sources: byRef,
      devices: byDevice,
      dailyTrend: Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,count])=>({date,count})),
    });
  }

  // ── POST /api/waitlist ────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/waitlist') {
    try {
      const body = await parseBody(req);
      const email    = (body.email || '').trim().toLowerCase();
      const name     = (body.name  || '').trim().substring(0, 100);
      const refCode  = (body.ref   || '').trim().substring(0, 20).toUpperCase() || null;

      if (!email || !isValidEmail(email))
        return json(res, 400, { success: false, message: 'Invalid email address.' });

      const data = loadJSON(WAITLIST_FILE);
      if (!data.members) data.members = [];

      const existing = data.members.find(m => m.email === email);
      if (existing) {
        return json(res, 200, {
          success: true,
          message: 'Already on the waitlist!',
          duplicate: true,
          position: data.members.findIndex(m => m.email === email) + 1,
          refCode: existing.refCode,
          referrals: existing.referrals || 0,
        });
      }

      // Generate unique referral code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();

      // Credit referrer if valid
      if (refCode) {
        const referrer = data.members.find(m => m.refCode === refCode);
        if (referrer) {
          referrer.referrals = (referrer.referrals || 0) + 1;
          referrer.updatedAt = new Date().toISOString();
        }
      }

      const member = {
        id: crypto.randomBytes(8).toString('hex'),
        email, name: name || null,
        refCode: code,
        referredBy: refCode || null,
        referrals: 0,
        joinedAt: new Date().toISOString(),
        ip: getIP(req),
      };

      data.members.push(member);
      saveJSON(WAITLIST_FILE, data);

      const position = data.members.length;
      console.log(`[waitlist] ${email} → #${position} (ref: ${refCode || 'none'})`);
      return json(res, 200, {
        success: true,
        message: `You're #${position} on the waitlist!`,
        position,
        refCode: code,
        referrals: 0,
        total: data.members.length,
      });

    } catch (err) {
      console.error('Waitlist error:', err);
      return json(res, 500, { success: false, message: 'Server error. Please try again.' });
    }
  }

  // ── GET /api/waitlist/position ────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/waitlist/position') {
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !isValidEmail(email))
      return json(res, 400, { success: false, message: 'Invalid email.' });

    const data = loadJSON(WAITLIST_FILE);
    const idx  = (data.members || []).findIndex(m => m.email === email);
    if (idx === -1)
      return json(res, 404, { success: false, message: 'Not found on waitlist.' });

    const member = data.members[idx];
    return json(res, 200, {
      success: true,
      position: idx + 1,
      total: data.members.length,
      refCode: member.refCode,
      referrals: member.referrals || 0,
    });
  }

  // ── GET /api/waitlist/stats ───────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/waitlist/stats') {
    const data = loadJSON(WAITLIST_FILE);
    const members = data.members || [];
    const topReferrers = members
      .filter(m => (m.referrals || 0) > 0)
      .sort((a, b) => b.referrals - a.referrals)
      .slice(0, 10)
      .map(m => ({ name: m.name || m.email.split('@')[0], referrals: m.referrals }));

    return json(res, 200, {
      success: true,
      total: members.length,
      topReferrers,
    });
  }

  // ── Admin: GET /api/admin/waitlist ────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/admin/waitlist') {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) return json(res, 401, { success: false, message: 'Unauthorized' });

    const data = loadJSON(WAITLIST_FILE);
    const members = data.members || [];
    return json(res, 200, {
      success: true,
      count: members.length,
      totalReferrals: members.reduce((sum, m) => sum + (m.referrals || 0), 0),
      members,
    });
  }

  // ── Health check ──────────────────────────────────────────────────────────
  if (pathname === '/api/health') {
    const subs = loadJSON(SUBSCRIBERS_FILE);
    const migs = loadJSON(MIGRATIONS_FILE);
    const anl  = loadJSON(ANALYTICS_FILE);
    const wl   = loadJSON(WAITLIST_FILE);
    return json(res, 200, {
      status: 'ok',
      subscribers: (subs.subscribers || []).length,
      migrations:  (migs.registrations || []).length,
      pageviews:   (anl.pageviews || []).length,
      waitlist:    (wl.members || []).length,
      ts: new Date().toISOString(),
    });
  }

  return json(res, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TEMPT Token API listening on port ${PORT}`);
});
