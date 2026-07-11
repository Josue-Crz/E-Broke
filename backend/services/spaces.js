// DigitalOcean Spaces (S3-compatible) photo storage.
// Decision (Abha): public-read bucket, plain URLs stored in listings.photo_urls.
// Configure SPACES_* env vars; until then the upload endpoint returns 503.

const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const { SPACES_KEY, SPACES_SECRET, SPACES_REGION, SPACES_BUCKET } = process.env;

function isConfigured() {
  return Boolean(SPACES_KEY && SPACES_SECRET && SPACES_REGION && SPACES_BUCKET);
}

let client;
function getClient() {
  if (!client) {
    client = new S3Client({
      endpoint: `https://${SPACES_REGION}.digitaloceanspaces.com`,
      region: 'us-east-1', // Spaces ignores this but the SDK requires it
      credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
    });
  }
  return client;
}

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

async function uploadPhoto(buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || 'bin';
  const key = `listings/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    })
  );

  // Use the CDN endpoint if set (recommended for the demo), else origin URL.
  const base =
    process.env.SPACES_CDN_BASE_URL ||
    `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com`;
  return `${base}/${key}`;
}

module.exports = { isConfigured, uploadPhoto };
