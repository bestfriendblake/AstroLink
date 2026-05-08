const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { z }     = require('zod');
const db        = require('../../config/database');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const registerSchema = z.object({
  username: z.string()
    .min(3,  'Username must be at least 3 characters')
    .max(32, 'Username must be 32 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address').max(255),
  password: z.string()
    .min(8,  'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or less'),
});

const loginSchema = z.object({
  username: z.string().max(32),
  password: z.string().max(72),
});

function issueToken(user, res) {
  const payload = {
    id:          user.id,
    username:    user.username,
    globalLevel: user.global_level,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('astrolink_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  return token;
}

router.post('/register', authLimiter, async (req, res) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }
  const { username, email, password } = result.data;

  try {
    const [existing] = await db.execute(
      'SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1',
      { username, email }
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const [insertResult] = await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (:username, :email, :password_hash)',
      { username, email, password_hash }
    );

    await db.execute(
      'INSERT INTO lunar_profiles (user_id) VALUES (:user_id)',
      { user_id: insertResult.insertId }
    );

    const newUser = { id: insertResult.insertId, username, global_level: 1 };
    issueToken(newUser, res);

    return res.status(201).json({
      message: 'Account created. Welcome to AstroLink.',
      user: { id: newUser.id, username },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { username, password } = result.data;

  try {
    const [rows] = await db.execute(
      'SELECT id, username, password_hash, global_level, is_banned, ban_reason FROM users WHERE username = :username LIMIT 1',
      { username }
    );

    const user  = rows[0] || { password_hash: '$2a$12$invalidhashfortimingprotection00000000000000' };
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!rows[0] || !valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: `Account suspended: ${user.ban_reason}` });
    }

    await db.execute('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id: user.id });
    issueToken(user, res);

    return res.json({
      user: { id: user.id, username: user.username, globalLevel: user.global_level },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie('astrolink_token');
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username, global_level, global_xp, stardust, created_at FROM users WHERE id = :id',
      { id: req.user.id }
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;