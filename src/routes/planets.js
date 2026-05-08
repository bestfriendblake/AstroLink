const express = require('express');
const db      = require('../../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLANET_TIERS = {
  moon:    1,
  mercury: 10,
  venus:   15,
  earth:   20,
  mars:    25,
  jupiter: 35,
  saturn:  45,
  uranus:  55,
  neptune: 65,
  pluto:   75,
};

const VALID_PLANETS = Object.keys(PLANET_TIERS);

router.get('/:planet', requireAuth, async (req, res) => {
  const planet = req.params.planet.toLowerCase();

  if (!VALID_PLANETS.includes(planet)) {
    return res.status(404).json({ error: 'Unknown planet' });
  }

  const requiredLevel = PLANET_TIERS[planet];
  const userLevel     = req.user.globalLevel;

  if (userLevel < requiredLevel) {
    return res.status(403).json({
      error:        `You must reach Global Level ${requiredLevel} to visit ${planet}`,
      requiredLevel,
      currentLevel: userLevel,
    });
  }

  try {
    const [species] = await db.execute(
      `SELECT id, internal_name, display_name, rarity, min_global_level,
              description, sprite_key
       FROM pet_species
       WHERE planet = :planet
         AND is_obtainable = TRUE
         AND min_global_level <= :userLevel
       ORDER BY rarity, display_name`,
      { planet, userLevel }
    );

    let profileData = null;
    if (planet === 'moon') {
      const [rows] = await db.execute(
        `SELECT lunar_level, lunar_xp, total_landings, successful_landings,
                best_landing_score
         FROM lunar_profiles WHERE user_id = :userId`,
        { userId: req.user.id }
      );
      profileData = rows[0] || null;
    }

    const [hiddenRows] = await db.execute(
      `SELECT COUNT(*) AS cnt FROM pet_species
       WHERE planet = :planet AND min_global_level > :userLevel AND is_obtainable = TRUE`,
      { planet, userLevel }
    );

    res.json({
      worldState: {
        planet,
        requiredLevel,
        spawnPool:          species,
        planetProfile:      profileData,
        hiddenSpeciesCount: hiddenRows[0]?.cnt || 0,
      }
    });
  } catch (err) {
    console.error('[Planets] Error:', err);
    res.status(500).json({ error: 'Failed to load planet data' });
  }
});

module.exports = router;