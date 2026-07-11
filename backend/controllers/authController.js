const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');
const { serializeUser } = require('../utils/serialize');

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine((e) => e.endsWith('@sfsu.edu'), { message: 'must be an @sfsu.edu email' }),
  password: z.string().min(8).max(200),
});

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// There is no email provider wired up (hackathon): the verification code is
// logged to the server console, and echoed in the response outside production.
function issueVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function register(req, res) {
  const { name, email, password } = parse(registerSchema, req.body);

  const passwordHash = await bcrypt.hash(password, 10);
  const code = issueVerificationCode();

  let user;
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, sfsu_email, password_hash, verification_code, verification_expires)
       VALUES ($1, $2, $3, $4, now() + interval '15 minutes')
       RETURNING *`,
      [name, email, passwordHash, code]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'EMAIL_TAKEN', 'An account with that email already exists');
    throw err;
  }

  console.log(`[verify-email] code for ${email}: ${code}`);
  req.session.userId = user.id;

  const body = { user: serializeUser(user) };
  if (process.env.NODE_ENV !== 'production') body.devVerificationCode = code;
  res.status(201).json(body);
}

async function verifyEmail(req, res) {
  const { email, code } = parse(verifySchema, req.body);

  const { rows } = await pool.query('SELECT * FROM users WHERE sfsu_email = $1', [email]);
  const user = rows[0];
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'No account with that email');
  if (user.verified_at) return res.json({ user: serializeUser(user) });

  if (!user.verification_code || user.verification_code !== code) {
    throw new HttpError(400, 'INVALID_CODE', 'Verification code is incorrect');
  }
  if (new Date(user.verification_expires) < new Date()) {
    throw new HttpError(400, 'CODE_EXPIRED', 'Verification code expired — register again to get a new one');
  }

  const updated = await pool.query(
    `UPDATE users SET verified_at = now(), verification_code = NULL, verification_expires = NULL
     WHERE id = $1 RETURNING *`,
    [user.id]
  );
  res.json({ user: serializeUser(updated.rows[0]) });
}

async function login(req, res) {
  const { email, password } = parse(loginSchema, req.body);

  const { rows } = await pool.query('SELECT * FROM users WHERE sfsu_email = $1', [email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

  req.session.userId = user.id;
  res.json({ user: serializeUser(user) });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
}

async function me(req, res) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
  if (!rows[0]) throw new HttpError(401, 'UNAUTHENTICATED', 'Account no longer exists');
  res.json({ user: serializeUser(rows[0]) });
}

module.exports = { register, verifyEmail, login, logout, me };
