/**
 * TEMPT Token Email Collection API
 * Saves subscriber emails to a persistent JSON file
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3031;
const DATA_DIR = path.join(__dirname, 'data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
const ADMIN_KEY = process.env.TEMPT_ADMIN_KEY || 'tempt-admin-2026';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize subscribers file
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
}

function loadSubscribers() {
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  } catch (e) {
    return { subscribers: [] };
  }
}

function saveSubscribers(data) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        // Try URL-encoded
        try {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [k, v] of params) obj[k] = v;
          resolve(obj);
        } catch (e2) {
          resolve({});
        }
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    });
    return res.end();
  }

  // POST /api/subscribe
  if (req.method === 'POST' && pathname === '/api/subscribe') {
    try {
      const body = await parseBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const source = (body.source || 'website').trim().substring(0, 50);
      const name = (body.name || '').trim().substring(0, 100);

      if (!email || !isValidEmail(email)) {
        return jsonResponse(res, 400, { success: false, message: 'Invalid email address.' });
      }

      const data = loadSubscribers();
      const existing = data.subscribers.find(s => s.email === email);

      if (existing) {
        return jsonResponse(res, 200, { success: true, message: 'Already subscribed!', duplicate: true });
      }

      data.subscribers.push({
        id: crypto.randomBytes(8).toString('hex'),
        email,
        name: name || null,
        source,
        subscribedAt: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
      });

      saveSubscribers(data);
      console.log(`[${new Date().toISOString()}] New subscriber: ${email} (source: ${source})`);

      return jsonResponse(res, 200, { success: true, message: "You're on the list! We'll notify you at launch." });

    } catch (err) {
      console.error('Subscribe error:', err);
      return jsonResponse(res, 500, { success: false, message: 'Server error. Please try again.' });
    }
  }

  // GET /api/admin/subscribers
  if (req.method === 'GET' && pathname === '/api/admin/subscribers') {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) {
      return jsonResponse(res, 401, { success: false, message: 'Unauthorized' });
    }

    const data = loadSubscribers();
    return jsonResponse(res, 200, {
      success: true,
      count: data.subscribers.length,
      subscribers: data.subscribers,
    });
  }

  // DELETE /api/admin/subscribers/:email
  if (req.method === 'DELETE' && pathname.startsWith('/api/admin/subscribers/')) {
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== ADMIN_KEY) {
      return jsonResponse(res, 401, { success: false, message: 'Unauthorized' });
    }

    const emailToDelete = decodeURIComponent(pathname.split('/').pop()).toLowerCase();
    const data = loadSubscribers();
    const before = data.subscribers.length;
    data.subscribers = data.subscribers.filter(s => s.email !== emailToDelete);

    if (data.subscribers.length === before) {
      return jsonResponse(res, 404, { success: false, message: 'Subscriber not found' });
    }

    saveSubscribers(data);
    return jsonResponse(res, 200, { success: true, message: `Removed ${emailToDelete}` });
  }

  // Health check
  if (pathname === '/api/health') {
    const data = loadSubscribers();
    return jsonResponse(res, 200, { status: 'ok', subscribers: data.subscribers.length, ts: new Date().toISOString() });
  }

  return jsonResponse(res, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TEMPT Token API running on port ${PORT}`);
});
