const express = require('express');
const { z }   = require('zod');
const db      = require('../../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 100,000 stardust = 10 moonstone
const CONVERSION_RATE = { stardust: 100000, moonstone: 10 };

// ── GET /api/currency/rates ───────────────────────────────────
router.get('/rates', requireAuth, (_req, res) => {
  res.json({
    conversion: CONVERSION_RATE,
    packages: [
      { id: 'starter',  moonstone: 10,  price: '$0.99',  bonus: 0 },
      { id: 'explorer', moonstone: 55,  price: '$4.99',  bonus: 5 },
      { id: 'voyager',  moonstone: 120, price: '$9.99',  bonus: 20 },
      { id: 'legend',   moonstone: 280, price: '$19.99', bonus: 80 },
    ],
  });
});

// ── POST /api/currency/convert ────────────────────────────────
// Convert stardust to moonstone in multiples of 100k
router.post('/convert', requireAuth, async (req, res) => {
  const schema = z.object({
    times: z.number().int().min(1).max(100),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Invalid input' });

  const { times }       = result.data;
  const stardustCost    = CONVERSION_RATE.stardust * times;
  const moonstoneGained = CONVERSION_RATE.moonstone * times;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT stardust, moonstone FROM users WHERE id = :userId FOR UPDATE',
      { userId: req.user.id }
    );
    const user = rows[0];

    if (parseFloat(user.stardust) < stardustCost) {
      await conn.rollback();
      return res.status(400).json({
        error: `Not enough stardust. Need ${stardustCost.toLocaleString()}, have ${parseFloat(user.stardust).toLocaleString()}.`
      });
    }

    const newStardust  = parseFloat(user.stardust) - stardustCost;
    const newMoonstone = user.moonstone + moonstoneGained;

    await conn.execute(
      'UPDATE users SET stardust = :sd, moonstone = :ms WHERE id = :userId',
      { sd: newStardust.toFixed(2), ms: newMoonstone, userId: req.user.id }
    );

    await conn.execute(
      `INSERT INTO stardust_conversions (user_id, stardust_spent, moonstone_gained)
       VALUES (:userId, :sd, :ms)`,
      { userId: req.user.id, sd: stardustCost, ms: moonstoneGained }
    );

    await conn.execute(
      `INSERT INTO transaction_log (user_id, amount, balance_after, reason)
       VALUES (:userId, :amount, :balance, 'admin_deduct')`,
      { userId: req.user.id, amount: -stardustCost, balance: newStardust.toFixed(2) }
    );

    await conn.commit();
    res.json({ newStardust, newMoonstone, stardustSpent: stardustCost, moonstoneGained });
  } catch (err) {
    await conn.rollback();
    console.error('[Currency] Convert error:', err);
    res.status(500).json({ error: 'Conversion failed' });
  } finally {
    conn.release();
  }
});

module.exports = router;