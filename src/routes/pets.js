const express = require('express');
const { z }   = require('zod');
const db      = require('../../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [pets] = await db.execute(
      `SELECT p.id, p.nickname, p.pet_level, p.pet_xp, p.is_locked, p.caught_at,
              p.stat_stealth, p.stat_evasion, p.stat_power, p.stat_endurance,
              s.display_name, s.rarity, s.planet, s.sprite_key
       FROM pets p
       JOIN pet_species s ON p.species_id = s.id
       WHERE p.user_id = :userId AND p.is_active = TRUE
       ORDER BY p.caught_at DESC`,
      { userId: req.user.id }
    );
    res.json({ pets });
  } catch (err) {
    console.error('[Pets] Inventory error:', err);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

const captureSchema = z.object({
  species_id: z.number().int().positive(),
  planet:     z.enum(['moon','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto']),
});

router.post('/capture', requireAuth, async (req, res) => {
  const result = captureSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten().fieldErrors });
  }
  const { species_id, planet } = result.data;

  try {
    const [speciesRows] = await db.execute(
      `SELECT * FROM pet_species
       WHERE id = :speciesId AND planet = :planet AND is_obtainable = TRUE LIMIT 1`,
      { speciesId: species_id, planet }
    );

    if (speciesRows.length === 0) {
      return res.status(404).json({ error: 'Pet species not found on this planet' });
    }

    const species = speciesRows[0];

    if (req.user.globalLevel < species.min_global_level) {
      return res.status(403).json({
        error: `Global Level ${species.min_global_level} required to encounter ${species.display_name}`,
      });
    }

    const roll = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const stats = {
      stealth:   roll(species.base_stealth_min,   species.base_stealth_max),
      evasion:   roll(species.base_evasion_min,   species.base_evasion_max),
      power:     roll(species.base_power_min,     species.base_power_max),
      endurance: roll(species.base_endurance_min, species.base_endurance_max),
    };

    const [insertResult] = await db.execute(
      `INSERT INTO pets
        (user_id, species_id, stat_stealth, stat_evasion, stat_power, stat_endurance, caught_on_planet)
       VALUES (:userId, :speciesId, :stealth, :evasion, :power, :endurance, :planet)`,
      { userId: req.user.id, speciesId: species_id, ...stats, planet }
    );

    res.status(201).json({
      pet: {
        id:          insertResult.insertId,
        displayName: species.display_name,
        rarity:      species.rarity,
        stats,
        planet,
      },
    });
  } catch (err) {
    console.error('[Pets] Capture error:', err);
    res.status(500).json({ error: 'Capture failed' });
  }
});

module.exports = router;