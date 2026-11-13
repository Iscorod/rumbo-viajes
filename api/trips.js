const crypto = require('node:crypto');
const API = 'https://api.github.com';
const ROOT = 'data/trips';
const ATTACHMENTS = 'data/attachments';

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

function encryptAttachment(bytes, secret) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { version: 1, encrypted: 'AES-256-GCM', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decryptAttachment(envelope, secret) {
  try {
    const key = crypto.scryptSync(secret, Buffer.from(envelope.salt, 'base64'), 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
  } catch {
    throw Object.assign(new Error('No se pudo descifrar el adjunto. Comprueba GITHUB_SYNC_KEY.'), { status: 401 });
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

async function readGitHubJson(path, cfg) {
  const file = await github(`${path}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
  if (file.content && file.encoding === 'base64') return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  const raw = await fetch(file.download_url, { headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.raw+json' } });
  if (!raw.ok) throw Object.assign(new Error('No se pudo leer el archivo adjunto desde GitHub.'), { status: 502 });
  return JSON.parse(await raw.text());
}

function validAttachmentPath(tripId, attachmentId) {
  return validId(tripId) && validId(attachmentId);
}

function validId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return response(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const cfg = config(req);
    const basePath = `/repos/${cfg.repo}/contents/${ROOT}`;
    const attachmentId = req.query && req.query.attachmentId;
    const tripId = req.query && req.query.tripId;
    if (req.method === 'GET' && attachmentId) {
      if (!validAttachmentPath(tripId, attachmentId)) return response(res, 400, { error: 'El adjunto solicitado no es válido.' });
      const path = `/repos/${cfg.repo}/contents/${ATTACHMENTS}/${tripId}/${attachmentId}.json`;
      const envelope = await readGitHubJson(path, cfg);
      const bytes = decryptAttachment(envelope, cfg.syncKey);
      return response(res, 200, { data: bytes.toString('base64') });
    }
    if (req.method === 'POST') {
      const attachment = req.body && req.body.attachment;
      if (!attachment || !validAttachmentPath(attachment.tripId, attachment.id) || typeof attachment.data !== 'string') return response(res, 400, { error: 'El adjunto no es válido.' });
      const bytes = Buffer.from(attachment.data, 'base64');
      if (!bytes.length || bytes.length > 1024 * 1024) return response(res, 413, { error: 'Cada adjunto puede ocupar como máximo 1 MB.' });
      const path = `/repos/${cfg.repo}/contents/${ATTACHMENTS}/${attachment.tripId}/${attachment.id}.json`;
      let sha;
      try { sha = (await github(`${path}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg)).sha; } catch (error) { if (error.status !== 404) throw error; }
      const content = Buffer.from(JSON.stringify(encryptAttachment(bytes, cfg.syncKey)), 'utf8').toString('base64');
      await github(path, { method: 'PUT', body: JSON.stringify({ message: `Añade adjunto de viaje ${attachment.tripId}`, content, branch: cfg.branch, ...(sha ? { sha } : {}) }) }, cfg);
      return response(res, 200, { attachment: { id: attachment.id, name: String(attachment.name || 'adjunto').slice(0, 160), type: String(attachment.type || 'application/octet-stream').slice(0, 100), size: bytes.length } });
    }
    if (req.method === 'DELETE' && attachmentId) {
      if (!validAttachmentPath(tripId, attachmentId)) return response(res, 400, { error: 'El adjunto solicitado no es válido.' });
      const path = `/repos/${cfg.repo}/contents/${ATTACHMENTS}/${tripId}/${attachmentId}.json`;
      const current = await github(`${path}?ref=${encodeURIComponent(cfg.branch)}`, {}, cfg);
      await github(path, { method: 'DELETE', body: JSON.stringify({ message: `Borra adjunto de viaje ${tripId}`, sha: current.sha, branch: cfg.branch }) }, cfg);
      return response(res, 200, { deleted: attachmentId });
    }
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
