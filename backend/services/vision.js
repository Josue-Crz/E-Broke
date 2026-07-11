// services/vision.js
//
// The ONLY file that talks to an AI provider. Swap providers (DigitalOcean
// Gradient vs. OpenAI) by changing the env vars in .env — both expose the
// same OpenAI-compatible /chat/completions API, so no code change is needed.
// If you switch to a provider with a different API shape, rewrite only the
// fetch call below; keep the exported function signature the same.

// ============================================================
// STRUCTURED-OUTPUT PROMPT — iterate on this freely.
// It asks the model to return ONLY the JSON object, no markdown,
// no commentary, matching the exact listing shape we validate later.
// ============================================================
const LISTING_PROMPT = `You are generating a listing for a free-items-only marketplace for university students.
Look at the photo and respond with ONLY a valid JSON object — no markdown fences, no explanation, no text before or after — in exactly this shape:

{
  "title": "string (short, descriptive item title)",
  "description": "string (2-3 sentences describing the item)",
  "category": "string (one of: furniture, appliances, electronics, books, clothing, kitchen, decor, other)",
  "condition": "string (one of: like-new, good, fair, worn)",
  "isFree": true,
  "flagged": false,
  "flagReason": null
}

Rules:
- "isFree" is always true.
- If the item is prohibited (alcohol, weapons, drugs, tobacco, or anything unsafe to give away), set "flagged" to true and "flagReason" to a short explanation.
- If the image is too blurry or you cannot identify an item, set "flagged" to true and "flagReason" to "unidentifiable image".
- When flagged, still fill in title/description/category/condition as best you can, or use "other"/"fair" if unknown.`;

/**
 * Send an image to the vision model and return the model's raw text output.
 * Parsing/validation happens in the controller, not here.
 *
 * @param {Buffer} imageBuffer - raw image bytes from the upload
 * @param {string} mimeType - e.g. "image/jpeg"
 * @returns {Promise<string>} raw model output
 */
async function analyzePhoto(imageBuffer, mimeType) {
  const apiKey = process.env.VISION_API_KEY;
  const baseUrl = process.env.VISION_BASE_URL;
  const model = process.env.VISION_MODEL;

  if (!apiKey || !baseUrl || !model) {
    throw new Error(
      'Missing vision config: set VISION_API_KEY, VISION_BASE_URL, and VISION_MODEL in .env'
    );
  }

  // Images go inline as a base64 data URI — no object storage involved.
  const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: LISTING_PROMPT },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vision API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { analyzePhoto };
