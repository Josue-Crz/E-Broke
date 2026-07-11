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

module.exports = { checkFreeOnly };
