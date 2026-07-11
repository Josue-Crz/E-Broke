const vision = require('../services/vision.js');

// Allowed values for the two enum fields — validation rejects anything else.
const CATEGORIES = ['furniture', 'appliances', 'electronics', 'books', 'clothing', 'kitchen', 'decor', 'other'];
const CONDITIONS = ['like-new', 'good', 'fair', 'worn'];

/**
 * Models often wrap JSON in markdown fences (```json ... ```) or add a line
 * of preamble ("Here is the listing:"). Instead of trying to strip every
 * variation, grab the substring from the first "{" to the last "}" — that is
 * the JSON object regardless of what surrounds it.
 */
function extractJson(rawText) {
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON object found');
  }
  return JSON.parse(rawText.slice(start, end + 1));
}

/**
 * Check the parsed object matches the exact listing shape.
 * Throws with a specific message so parse failures are easy to debug.
 */
function validateListing(listing) {
  if (typeof listing.title !== 'string' || listing.title.length === 0) {
    throw new Error('title must be a non-empty string');
  }
  if (typeof listing.description !== 'string' || listing.description.length === 0) {
    throw new Error('description must be a non-empty string');
  }
  if (!CATEGORIES.includes(listing.category)) {
    throw new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!CONDITIONS.includes(listing.condition)) {
    throw new Error(`condition must be one of: ${CONDITIONS.join(', ')}`);
  }
  if (listing.isFree !== true) {
    throw new Error('isFree must be true');
  }
  if (typeof listing.flagged !== 'boolean') {
    throw new Error('flagged must be a boolean');
  }
  if (listing.flagged) {
    if (typeof listing.flagReason !== 'string' || listing.flagReason.length === 0) {
      throw new Error('flagReason must be a non-empty string when flagged');
    }
  } else if (listing.flagReason !== null) {
    throw new Error('flagReason must be null when not flagged');
  }
}

// POST /listings/analyze-photo
async function analyzePhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded. Send an image under the field name "photo".' });
  }
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'Uploaded file must be an image.' });
  }

  let rawOutput;
  try {
    rawOutput = await vision.analyzePhoto(req.file.buffer, req.file.mimetype);
  } catch (err) {
    console.error('Vision call failed:', err.message);
    return res.status(502).json({ error: 'Vision model request failed' });
  }

  // Always log the raw output so raw vs. parsed can be compared per request.
  console.log('--- raw model output ---');
  console.log(rawOutput);
  console.log('------------------------');

  let listing;
  try {
    listing = extractJson(rawOutput);
    validateListing(listing);
  } catch (err) {
    console.error('Parse/validation failed:', err.message);
    return res.status(502).json({ error: 'AI returned invalid format', raw: rawOutput });
  }

  // Return only the expected fields, dropping anything extra the model added.
  return res.json({
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition,
    isFree: listing.isFree,
    flagged: listing.flagged,
    flagReason: listing.flagReason,
  });
}

module.exports = { analyzePhoto };
