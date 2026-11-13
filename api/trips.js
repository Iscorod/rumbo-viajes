const crypto = require('node:crypto');
const API = 'https://api.github.com';
const ROOT = 'data/trips';

function response(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function config(req) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const syncKey = process.env.GITHUB_SYNC_KEY;
  if (!token || !repo || !syncKey) throw Object.assign(new Error('Falta configurar GITHUB_TOKEN, GITHUB_REPO y GITHUB_SYNC_KEY en Vercel.'), { status: 503 });
  if (req.headers['x-rumbo-sync-key'] !== syncKey) throw Object.assign(new Error('La clave de sincronización no es correcta.'), { status: 401 });
  return { token, repo, syncKey, branch: process.env.GITHUB_BRANCH || 'main' };
}

function encryptTrip(trip, secret) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify({ ...trip, updatedAt: new Date().toISOString() }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: 1,
    encrypted: 'AES-256-GCM',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

function decryptTrip(envelope, secret) {
  if (!envelope || envelope.encrypted !== 'AES-256-GCM' || envelope.version !== 1) return envelope;
  try {
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const key = crypto.scryptSync(secret, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw Object.assign(new Error('No se pudieron descifrar los viajes. Comprueba GITHUB_SYNC_KEY.'), { status: 401 });
  }
}

async function github(path, options, cfg) {
  const result = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options && options.headers),
    },
  });
  const body = result.status === 204 ? null : await result.json().catch(() => null);
  if (!result.ok) {
    const message = body && body.message ? body.message : `GitHub respondió ${result.status}`;
    throw Object.assign(new Error(message), { status: result.status === 404 ? 404 : 502 });
  }
  return body;
}

function validId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return response(res, 204, {});
  }
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return response(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const cfg = config(req);
    const basePath = `/repos/${cfg.repo}/contents/${ROOT}`;
    if (req.method === 'GET') {
      let files;
      try {
        files = await github(`${basePath}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
      } catch (error) {
        if (error.status === 404) return response(res, 200, { trips: [] });
        throw error;
      }
      if (!Array.isArray(files)) return response(res, 200, { trips: [] });
      const trips = await Promise.all(files.filter(file => file.type === 'file' && file.name.endsWith('.json')).map(async file => {
        const saved = await github(`${basePath}/${encodeURIComponent(file.name)}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
        const envelope = JSON.parse(Buffer.from(saved.content, 'base64').toString('utf8'));
        return decryptTrip(envelope, cfg.syncKey);
      }));
      return response(res, 200, { trips });
    }

    const id = req.method === 'PUT' ? req.body && req.body.trip && req.body.trip.id : req.query && req.query.id;
    if (!validId(id)) return response(res, 400, { error: 'El identificador del viaje no es válido.' });
    const filePath = `${basePath}/${id}.json`;
    let sha;
    try {
      const current = await github(`${filePath}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
      sha = current.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    if (req.method === 'DELETE') {
      if (!sha) return response(res, 404, { error: 'No se encontró ese viaje en GitHub.' });
      await github(filePath, { method: 'DELETE', body: JSON.stringify({ message: `Borra viaje ${id} desde Rumbo`, sha, branch: cfg.branch }) }, cfg);
      return response(res, 200, { deleted: id });
    }

    const trip = req.body.trip;
    if (!trip || typeof trip.name !== 'string' || !trip.start || !trip.end || !Array.isArray(trip.flights) || !Array.isArray(trip.events)) {
      return response(res, 400, { error: 'El contenido del viaje está incompleto.' });
    }
    const content = Buffer.from(JSON.stringify(encryptTrip(trip, cfg.syncKey), null, 2), 'utf8').toString('base64');
    await github(filePath, { method: 'PUT', body: JSON.stringify({ message: `Guarda viaje ${trip.name} desde Rumbo`, content, branch: cfg.branch, ...(sha ? { sha } : {}) }) }, cfg);
    return response(res, 200, { saved: id, path: `${ROOT}/${id}.json` });
  } catch (error) {
    const status = error.status || 500;
    return response(res, status, { error: error.message || 'No se pudo sincronizar con GitHub.' });
  }
};
