const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { HttpError } = require('../utils/errors');
const spaces = require('../services/spaces');

// Local fallback when Spaces isn't configured (localhost demos): files land
// in backend/uploads/ and are served by express.static at /uploads.
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

async function uploadPhotoToDisk(req) {
  const ext = EXT_BY_MIME[req.file.mimetype] || 'bin';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, filename), req.file.buffer);
  // Absolute URL so the frontend (a different origin in dev) can render it.
  // Behind a path prefix (App Platform routes the API at /api), set
  // UPLOADS_PUBLIC_BASE (e.g. https://your-app.ondigitalocean.app/api).
  const base = process.env.UPLOADS_PUBLIC_BASE || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
}

// POST /uploads/photo — multipart upload (field "photo").
// Spaces when configured (production), local disk otherwise (demo/dev).
async function uploadPhoto(req, res) {
  if (!req.file) throw new HttpError(400, 'VALIDATION_ERROR', 'Send an image under the field name "photo"');
  if (!req.file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Uploaded file must be an image');
  }

  const url = spaces.isConfigured()
    ? await spaces.uploadPhoto(req.file.buffer, req.file.mimetype)
    : await uploadPhotoToDisk(req);
  res.status(201).json({ url });
}

module.exports = { uploadPhoto };
