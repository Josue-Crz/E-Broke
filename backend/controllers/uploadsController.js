const { HttpError } = require('../utils/errors');
const spaces = require('../services/spaces');

// POST /uploads/photo — multipart upload (field "photo") → DO Spaces →
// public CDN URL, which the client then passes in POST /listings photoUrls.
async function uploadPhoto(req, res) {
  if (!spaces.isConfigured()) {
    throw new HttpError(503, 'SPACES_NOT_CONFIGURED', 'Photo storage is not configured — set the SPACES_* env vars');
  }
  if (!req.file) throw new HttpError(400, 'VALIDATION_ERROR', 'Send an image under the field name "photo"');
  if (!req.file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Uploaded file must be an image');
  }

  const url = await spaces.uploadPhoto(req.file.buffer, req.file.mimetype);
  res.status(201).json({ url });
}

module.exports = { uploadPhoto };
