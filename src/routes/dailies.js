const express = require('express');
const { z }   = require('zod');
const db      = require('../../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Streak milestone rewards
const STREAK_REWARDS = {
  1:  { stardust: 50,  moonstone: 0 },
  2:  { stardust: 100, moonstone: 0 },
  3:  { stardust: 200, moonstone: 1 },
  4:  { stardust: 200, moonstone: 1 },
  5:  { stardust: 300, moonstone: 2 },
  6:  { stardust: 300, moonstone: 2 },
  7:  { stardust: 500, moonstone: 5 },
  14: { stardust: 750, moonstone: 8 },
  30: { stardust: 1000, moonstone: 20 },
};

function getStreakReward(streak) {
  const milestones = [30, 14, 7, 6, 5, 4, 3, 2, 1];
  for (const m of milestones) {
    if (streak >= m) return STREAK_REWARDS[m];
  }
  return { stardust: 50, moonstone: 0 };
}

// Quest templates
const QUEST_TEMPLATES = [
  { quest_type: 'play_games',      target: 3,    reward_stardust: 150,  reward_moonstone: 0 },
  { quest_type: 'play_games',      target: 5,    reward_stardust: 300,  reward_moonstone: 1 },
  { quest_type: 'catch_pets',      target: 2,    reward_stardust: 200,  reward_moonstone: 0 },
  { quest_type: 'catch_pets',      target: 5,    reward_stardust: 400,  reward_moonstone: 2 },
  { quest_type: 'earn_stardust',   target: 500,  reward_stardust: 250,  reward_moonstone: 0 },
  { quest_type: 'earn_stardust',   target: 1000, reward_stardust: 500,  reward_moonstone: 2 },
];

function pickDailyQuests() {
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  const types    = new Set();
  const picked   = [];
  for (const q of shuffled) {
    if (!types.has(q.quest_type)) {
      types.add(q.quest_type);
      picked.push(q);
    }
    if (picked.length === 3) break;
  }
  return picked;
}

// Slot machine symbols and prizes
const SLOT_SYMBOLS = ['⭐', '🌙', '💎', '🚀', '🦋', '☄️'];
const SLOT_PRIZES  = {
  '⭐⭐⭐': { type: 'stardust',  value: 500 },
  '🌙🌙🌙': { type: 'moonstone', value: 10 },
  '💎💎💎': { type: 'moonstone', value: 5 },
  '🚀🚀🚀': { type: 'stardust',  value: 1000 },
  '🦋🦋🦋': { type: 'moonstone', value: 3 },
  '☄️☄️☄️': { type: 'stardust',  value: 750 },
  'two':    { type: 'stardust',  value: 100 },
  'none':   { type: 'nothing',   value: 0 },
};

function spinReels() {
  // Weighted — full matches are rare
  const reels = Array.from({ length: 3 }, () => {
    const rand = Math.random();
    if (rand < 0.35)      return '⭐';
    if (rand < 0.60)      return '🚀';
    if (rand < 0.75)      return '🦋';
    if (rand < 0.85)      return '☄️';
    if (rand < 0.93)      return '💎';
    return '🌙';
  });

  const key = reels.join('');
  if (SLOT_PRIZES[key]) return { reels, prize: SLOT_PRIZES[key] };

  const twoMatch = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
  if (twoMatch) return { reels, prize: SLOT_PRIZES['two'] };

  return { reels, prize: SLOT_PRIZES['none'] };
}

// ── GET /api/dailies/status ───────────────────────────────────
// Returns everything the dashboard needs in one call
router.get('/status', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10);

  try {
    // Streak
    let [streakRows] = await db.execute(
      'SELECT * FROM daily_streaks WHERE user_id = :userId',
      { userId }
    );
    let streak = streakRows[0] || null;
    const canClaimStreak = !streak || streak.last_claim_date !== today;

    // Spin
    const [spinRows] = await db.execute(
      'SELECT * FROM daily_spins WHERE user_id = :userId AND spin_date = :today',
      { userId, today }
    );
    const canSpin = spinRows.length === 0;

    // Quests — create if missing
    let [questRows] = await db.execute(
      'SELECT * FROM daily_quests WHERE user_id = :userId AND quest_date = :today',
      { userId, today }
    );
    if (questRows.length === 0) {
      const quests = pickDailyQuests();
      for (const q of quests) {
        await db.execute(
          `INSERT INTO daily_quests
            (user_id, quest_date, quest_type, target, reward_stardust, reward_moonstone)
           VALUES (:userId, :today, :type, :target, :rs, :rm)`,
          { userId, today, type: q.quest_type, target: q.target, rs: q.reward_stardust, rm: q.reward_moonstone }
        );
      }
      [questRows] = await db.execute(
        'SELECT * FROM daily_quests WHERE user_id = :userId AND quest_date = :today',
        { userId, today }
      );
    }

    res.json({
      streak: {
        current:       streak?.current_streak || 0,
        longest:       streak?.longest_streak || 0,
        lastClaim:     streak?.last_claim_date || null,
        canClaim:      canClaimStreak,
        nextReward:    getStreakReward((streak?.current_streak || 0) + 1),
      },
      spin: {
        canSpin,
        lastResult: spinRows[0] || null,
      },
      quests: questRows,
    });
  } catch (err) {
    console.error('[Dailies] Status error:', err);
    res.status(500).json({ error: 'Failed to load dailies' });
  }
});

// ── POST /api/dailies/streak/claim ────────────────────────────
router.post('/streak/claim', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10);
  const conn   = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM daily_streaks WHERE user_id = :userId FOR UPDATE',
      { userId }
    );
    const streak = rows[0];

    if (streak && streak.last_claim_date === today) {
      await conn.rollback();
      return res.status(400).json({ error: 'Already claimed today' });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const isConsecutive = streak && streak.last_claim_date === yStr;
    const newStreak     = isConsecutive ? streak.current_streak + 1 : 1;
    const longest       = Math.max(newStreak, streak?.longest_streak || 0);
    const reward        = getStreakReward(newStreak);

    if (!streak) {
      await conn.execute(
        `INSERT INTO daily_streaks
          (user_id, current_streak, longest_streak, last_claim_date, total_claims)
         VALUES (:userId, :streak, :longest, :today, 1)`,
        { userId, streak: newStreak, longest, today }
      );
    } else {
      await conn.execute(
        `UPDATE daily_streaks SET
          current_streak = :streak, longest_streak = :longest,
          last_claim_date = :today, total_claims = total_claims + 1
         WHERE user_id = :userId`,
        { streak: newStreak, longest, today, userId }
      );
    }

    const [userRows] = await conn.execute(
      'SELECT stardust, moonstone FROM users WHERE id = :userId FOR UPDATE',
      { userId }
    );
    const newStardust  = parseFloat(userRows[0].stardust) + reward.stardust;
    const newMoonstone = userRows[0].moonstone + reward.moonstone;

    await conn.execute(
      'UPDATE users SET stardust = :sd, moonstone = :ms WHERE id = :userId',
      { sd: newStardust.toFixed(2), ms: newMoonstone, userId }
    );

    await conn.execute(
      `INSERT INTO transaction_log (user_id, amount, balance_after, reason)
       VALUES (:userId, :amount, :balance, 'game_reward')`,
      { userId, amount: reward.stardust, balance: newStardust.toFixed(2) }
    );

    await conn.commit();
    res.json({ streak: newStreak, reward, newStardust, newMoonstone });
  } catch (err) {
    await conn.rollback();
    console.error('[Dailies] Streak claim error:', err);
    res.status(500).json({ error: 'Failed to claim streak' });
  } finally {
    conn.release();
  }
});

// ── POST /api/dailies/spin ────────────────────────────────────
router.post('/spin', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10);
  const conn   = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute(
      'SELECT id FROM daily_spins WHERE user_id = :userId AND spin_date = :today',
      { userId, today }
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Already spun today' });
    }

    const { reels, prize } = spinReels();

    await conn.execute(
      `INSERT INTO daily_spins (user_id, spin_date, result_type, result_value, reels)
       VALUES (:userId, :today, :type, :value, :reels)`,
      { userId, today, type: prize.type, value: prize.value, reels: reels.join(',') }
    );

    if (prize.value > 0) {
      const [userRows] = await conn.execute(
        'SELECT stardust, moonstone FROM users WHERE id = :userId FOR UPDATE',
        { userId }
      );
      if (prize.type === 'stardust') {
        const newBal = parseFloat(userRows[0].stardust) + prize.value;
        await conn.execute(
          'UPDATE users SET stardust = :bal WHERE id = :userId',
          { bal: newBal.toFixed(2), userId }
        );
        await conn.execute(
          `INSERT INTO transaction_log (user_id, amount, balance_after, reason)
           VALUES (:userId, :amount, :balance, 'game_reward')`,
          { userId, amount: prize.value, balance: newBal.toFixed(2) }
        );
      } else if (prize.type === 'moonstone') {
        await conn.execute(
          'UPDATE users SET moonstone = moonstone + :val WHERE id = :userId',
          { val: prize.value, userId }
        );
      }
    }

    await conn.commit();
    res.json({ reels, prize });
  } catch (err) {
    await conn.rollback();
    console.error('[Dailies] Spin error:', err);
    res.status(500).json({ error: 'Spin failed' });
  } finally {
    conn.release();
  }
});

// ── POST /api/dailies/quest/claim ─────────────────────────────
router.post('/quest/claim', requireAuth, async (req, res) => {
  const schema = z.object({ quest_id: z.number().int().positive() });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: 'Invalid quest id' });

  const { quest_id } = result.data;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT * FROM daily_quests
       WHERE id = :questId AND user_id = :userId FOR UPDATE`,
      { questId: quest_id, userId: req.user.id }
    );

    const quest = rows[0];
    if (!quest)              { await conn.rollback(); return res.status(404).json({ error: 'Quest not found' }); }
    if (!quest.completed)    { await conn.rollback(); return res.status(400).json({ error: 'Quest not completed yet' }); }
    if (quest.claimed)       { await conn.rollback(); return res.status(400).json({ error: 'Already claimed' }); }

    await conn.execute(
      'UPDATE daily_quests SET claimed = TRUE WHERE id = :questId',
      { questId: quest_id }
    );

    const [userRows] = await conn.execute(
      'SELECT stardust, moonstone FROM users WHERE id = :userId FOR UPDATE',
      { userId: req.user.id }
    );
    const newStardust  = parseFloat(userRows[0].stardust) + quest.reward_stardust;
    const newMoonstone = userRows[0].moonstone + quest.reward_moonstone;

    await conn.execute(
      'UPDATE users SET stardust = :sd, moonstone = :ms WHERE id = :userId',
      { sd: newStardust.toFixed(2), ms: newMoonstone, userId: req.user.id }
    );

    await conn.commit();
    res.json({ newStardust, newMoonstone, reward: { stardust: quest.reward_stardust, moonstone: quest.reward_moonstone } });
  } catch (err) {
    await conn.rollback();
    console.error('[Dailies] Quest claim error:', err);
    res.status(500).json({ error: 'Failed to claim quest' });
  } finally {
    conn.release();
  }
});

module.exports = router;