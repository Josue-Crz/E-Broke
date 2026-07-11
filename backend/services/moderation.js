// Free-only enforcement: e-Broke has no prices, ever.
// Regex pass over user-provided listing text; rejects anything that looks
// like an attempt to sell. (A Gradient LLM check can be layered on later —
// keep this function's signature and add a second await inside.)

const SELLING_PATTERNS = [
  { re: /\$\s*\d/, label: 'a dollar amount' },
  { re: /\b\d+\s*(dollars|bucks|usd)\b/i, label: 'a dollar amount' },
  { re: /\b(venmo|zelle|cash\s*app|cashapp|paypal|apple\s*pay)\b/i, label: 'a payment app' },
  { re: /\bobo\b/i, label: '"OBO" (or best offer)' },
  { re: /\b(for\s+sale|asking\s+price|best\s+offer|price\s*:|will\s+sell|selling\s+(it\s+)?for)\b/i, label: 'sale language' },
  { re: /\b(pay\s+me|send\s+me\s+money|cash\s+only)\b/i, label: 'a payment request' },
];

/**
 * Check listing text against the free-only rules.
 * @param {...string} texts - title, description, etc.
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkFreeOnly(...texts) {
  const combined = texts.filter(Boolean).join('\n');
  for (const { re, label } of SELLING_PATTERNS) {
    if (re.test(combined)) {
      return { ok: false, reason: `Listing text contains ${label} — e-Broke is free-items-only` };
    }
  }
  return { ok: true };
}



// ============================================================
// LLM moderation agent (second layer, runs on listing create).
// Calls the Gradient chat model with a strict-JSON prompt.
// FAIL-OPEN by design: any API error, bad JSON, or >3s timeout
// allows the listing and logs a warning — moderation must never
// block the demo or crash a request.
// ============================================================

const MODERATION_PROMPT = `You are the content moderator for e-Broke, a free-items-only marketplace where university students give items away. Review the listing text below and respond with ONLY a valid JSON object — no markdown fences, no commentary — in exactly this shape:

{"allowed": true, "category": "ok", "reason": ""}

Categories (pick one):
- "ok": a normal free item listing. allowed = true.
- "price_selling": any attempt to sell — prices, payment requests, trades for money. allowed = false.
- "harmful": weapons, alcohol, drugs, or anything unsafe or illegal to give away. allowed = false.
- "spam": gibberish, advertising, or clearly not a real item. allowed = false.

When allowed is false, "reason" must be one short sentence a student will read (e.g. "Listings can't include a price — everything on e-Broke is free.").
Do not flag normal free listings — giving things away is the whole point.`;

const MODERATION_TIMEOUT_MS = 3000;
const VALID_CATEGORIES = ['ok', 'price_selling', 'harmful', 'spam'];

async function llmModerate(title, description) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${process.env.VISION_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.VISION_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.VISION_MODEL,
        max_completion_tokens: 300,
        messages: [
          { role: 'user', content: `${MODERATION_PROMPT}\n\nTitle: ${title}\nDescription: ${description}` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`moderation API returned ${response.status}`);

    const data = await response.json();
    const raw = data.choices[0].message.content;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const verdict = JSON.parse(raw.slice(start, end + 1));

    if (typeof verdict.allowed !== 'boolean' || !VALID_CATEGORIES.includes(verdict.category)) {
      throw new Error('moderation verdict has unexpected shape');
    }
    return {
      allowed: verdict.allowed,
      category: verdict.category,
      reason: typeof verdict.reason === 'string' ? verdict.reason : '',
    };
  } catch (err) {
    console.warn(`[moderation] fail-open (${err.name === 'AbortError' ? 'timeout' : err.message}) — allowing listing`);
    return { allowed: true, category: 'ok', reason: '', failOpen: true };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { checkFreeOnly, llmModerate };
