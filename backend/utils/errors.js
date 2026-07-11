// Error + validation helpers shared by all controllers.
// Express 5 forwards rejected promises to the error handler automatically,
// so controllers can just `throw new HttpError(...)` inside async functions.

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Validate `data` against a zod schema. Throws a 400 with a readable
// summary of every failed field; returns the parsed (typed, coerced) data.
function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message)
      .join('; ');
    throw new HttpError(400, 'VALIDATION_ERROR', message);
  }
  return result.data;
}

module.exports = { HttpError, parse };
