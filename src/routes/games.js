const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');
const db      = require('../../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const LANDING = {
  MAX_SAFE_VELOCITY:    2.5,
  MAX_FUEL_USAGE:       100,
  MIN_FLIGHT_MS:        5000,
  MAX_FLIGHT_MS:        300000,
  LANDING_ZONE_RADIUS:  50,
  BASE_SCORE:           1000,
  STARDUST_PER_SCORE:   0.05,
};

const telemetrySchema = z.object({
  session_token:      z.string().length(64),
  fuel_used:          z.number().int().min(0).max(LANDING.MAX_FUEL_USAGE),
  final_velocity:     z.number().min(0).max(50),
  touchdown_x:        z.number().min(-1000).max(1000),
  touchdown_y:        z.number().min(-1000).max(1000),
  flight_duration_ms: z.number().int().min(0).max(LANDING.MAX_FLIGHT_MS),
});

router.post('/lunar-descent/start', requireAuth, async (req, res) => {
  try {
    await db.execute(
      'DELETE FROM game_sessions WHERE user_id = :userId AND expires_at < NOW()',
      { userId: req.user.id }
    );

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.execute(
      `INSERT INTO game_sessions (user_id, planet, session_token, expires_at)
       VALUES (:userId, 'moon', :token, :expiresAt)`,
      { userId: req.user.id, token, expiresAt }
    );

    res.json({ session_token: token, expires_at: expiresAt });
  } catch (err) {
    console.error('[Game] Start error:', err);
    res.status(500).json({ error: 'Failed to start game session' });
  }
});

router.post('/lunar-descent/submit', requireAuth, async (req, res) => {
  const result = telemetrySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }
  const data = result.data;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [sessions] = await connection.execute(
      `SELECT id FROM game_sessions
       WHERE session_token = :token
         AND user_id = :userId
         AND used = FALSE
         AND expires_at > NOW()
       LIMIT 1`,
      { token: data.session_token, userId: req.user.id }
    );

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Invalid or expired game session' });
    }

    await connection.execute(
      'UPDATE game_sessions SET used = TRUE WHERE id = :id',
      { id: sessions[0].id }
    );

    const validation      = validateLanding(data);
    let scoreAwarded      = 0;
    let stardustAwarded   = 0;

    if (validation.isValid) {
      scoreAwarded    = calculateScore(data);
      stardustAwarded = parseFloat((scoreAwarded * LANDING.STARDUST_PER_SCORE).toFixed(2));
    }

    await connection.execute(
      `INSERT INTO landing_telemetry
        (user_id, session_token, fuel_used, final_velocity, touchdown_x,
         touchdown_y, flight_duration_ms, is_valid_landing, validation_reason,
         score_awarded, stardust_awarded, flagged_for_review)
       VALUES
        (:userId, :token, :fuelUsed, :velocity, :touchX, :touchY,
         :duration, :isValid, :reason, :score, :stardust, :flagged)`,
      {
        userId:   req.user.id,
        token:    data.session_token,
        fuelUsed: data.fuel_used,
        velocity: data.final_velocity,
        touchX:   data.touchdown_x,
        touchY:   data.touchdown_y,
        duration: data.flight_duration_ms,
        isValid:  validation.isValid,
        reason:   validation.reason || null,
        score:    scoreAwarded,
        stardust: stardustAwarded,
        flagged:  validation.flagged,
      }
    );

    if (validation.isValid && stardustAwarded > 0) {
      const [userRows] = await connection.execute(
        'SELECT stardust FROM users WHERE id = :id FOR UPDATE',
        { id: req.user.id }
      );
      const newBalance = parseFloat(userRows[0].stardust) + stardustAwarded;

      await connection.execute(
        'UPDATE users SET stardust = :balance WHERE id = :id',
        { balance: newBalance.toFixed(2), id: req.user.id }
      );

      await connection.execute(
        `UPDATE lunar_profiles
         SET total_landings = total_landings + 1,
             successful_landings = successful_landings + 1,
             total_stardust_earned = total_stardust_earned + :stardust,
             best_landing_score = GREATEST(best_landing_score, :score),
             last_visited_at = NOW()
         WHERE user_id = :userId`,
        { stardust: stardustAwarded, score: scoreAwarded, userId: req.user.id }
      );

      await connection.execute(
        `INSERT INTO transaction_log (user_id, amount, balance_after, reason)
         VALUES (:userId, :amount, :balance, 'game_reward')`,
        { userId: req.user.id, amount: stardustAwarded, balance: newBalance.toFixed(2) }
      );
    } else {
      await connection.execute(
        `UPDATE lunar_profiles
         SET total_landings = total_landings + 1, last_visited_at = NOW()
         WHERE user_id = :userId`,
        { userId: req.user.id }
      );
    }

    await connection.commit();
    res.json({ success: validation.isValid, reason: validation.reason, scoreAwarded, stardustAwarded });

  } catch (err) {
    await connection.rollback();
    console.error('[Game] Submit error:', err);
    res.status(500).json({ error: 'Failed to process landing' });
  } finally {
    connection.release();
  }
});

function validateLanding(data) {
  if (data.flight_duration_ms < LANDING.MIN_FLIGHT_MS) {
    return { isValid: false, reason: 'Flight duration too short', flagged: true };
  }
  if (data.fuel_used > LANDING.MAX_FUEL_USAGE) {
    return { isValid: false, reason: 'Invalid fuel reading', flagged: true };
  }
  if (data.final_velocity > LANDING.MAX_SAFE_VELOCITY) {
    return { isValid: false, reason: `Landing velocity too high (${data.final_velocity.toFixed(2)} m/s)`, flagged: false };
  }
  const dist = Math.sqrt(data.touchdown_x ** 2 + data.touchdown_y ** 2);
  if (dist > LANDING.LANDING_ZONE_RADIUS) {
    return { isValid: false, reason: `Missed landing zone (${dist.toFixed(1)} units off target)`, flagged: false };
  }
  return { isValid: true, reason: 'Valid landing', flagged: false };
}

function calculateScore(data) {
  let score = LANDING.BASE_SCORE;
  score += Math.floor((LANDING.MAX_SAFE_VELOCITY - data.final_velocity) * 100);
  score += Math.floor((LANDING.MAX_FUEL_USAGE - data.fuel_used) * 5);
  const dist = Math.sqrt(data.touchdown_x ** 2 + data.touchdown_y ** 2);
  score += Math.max(0, Math.floor((LANDING.LANDING_ZONE_RADIUS - dist) * 10));
  return Math.max(0, score);
}

module.exports = router;