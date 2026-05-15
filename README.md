# AstroLink: Technical Specification & Project Roadmap
**Version:** 1.0.0
**Project Lead:** Gemini/User Collaboration
**Primary Audience:** Claude (LLM) / Developers

## 1. Executive Summary
AstroLink is a persistent, browser-based "Pet RPG" and resource management ecosystem built on a Node.js backend with an SQLite persistence layer and a Tailwind CSS frontend. The project utilizes a decentralized hub-and-spoke world model where 10 celestial bodies act as distinct "game states" with unique mechanics, currencies, and pet species.

The primary goal is to balance the "Vanilla Browser" nostalgia of early-2000s pet sites with modern responsive UI and deep-level progression hooks (Level-Locking and Planetary Mastery).

---

## 2. Core Game Loop
1.  **Exploration:** Navigate the solar system via the Travel Engine.
2.  **Acquisition:** Engage in planet-specific mini-games to earn "Stardust" (Soft Currency) and encounter pets.
3.  **Progression:** Increase "Planetary Mastery" to unlock higher-tier pet spawns and more difficult mini-game modes.
4.  **Maintenance:** Utilize Earth-grown "Universal Food" to manage pet decay stats (Hunger/Happiness).
5.  **Competition:** Utilize the Combat Engine for 1v1 or 3v3 planetary-typed battles.

---

## 3. The Celestial Ecosystem (Planetary Logic)

### Mercury: The Solar Crucible
* **Power / Type:** Solar & Radiation
* **Mechanic Style:** Management Simulation.
* **Primary Interaction:** Players must align a series of solar shields to prevent orbital probes and pet habitats from overheating. Success is measured by "Degrees Prevented."
* **Pet Archetype:** Glass-bodied, glowing energy-absorbers. These pets thrive on light and often have semi-transparent, luminous sprites.

### Venus: The Greenhouse Vault
* **Power / Type:** Volcanic & Greenhouse
* **Mechanic Style:** Precision Platforming.
* **Primary Interaction:** Players navigate a pet through a hazardous landscape of sinking basalt pillars and rising lava levels.
* **Pet Archetype:** Rock-skinned, soot-covered, heavy reptilians. These creatures are designed with high defense stats and heat-resistant traits.

### The Moon: The Silver Outpost
* **Power / Type:** Lunar & Tide
* **Mechanic Style:** Turn-based Strategy.
* **Primary Interaction:** Managing "lunar phases" on a grid-based map to reveal hidden paths or treasure caches that only appear under specific light conditions.
* **Pet Archetype:** Pale, nocturnal, owl-like or lunar-moth types. They possess high agility and "Stealth" modifiers in battle.

### Mars: The Oxide Plains
* **Power / Type:** Dust & Oxide
* **Mechanic Style:** High-speed Racing.
* **Primary Interaction:** Rover-style navigation through procedurally generated sandstorms. Players must manage fuel and traction on rusted terrain.
* **Pet Archetype:** Scavenger-like, rusty-furred, nomadic mammals. Often featuring mechanical augmentations or "found-object" armor.

### Jupiter: The Great Vortex
* **Power / Type:** Gravity & Vortex
* **Mechanic Style:** Physics-based Slingshot.
* **Primary Interaction:** Using the planet's intense gravity to "slingshot" probes into specific gas clouds to collect rare elements.
* **Pet Archetype:** Cyclonic, multi-eyed, sentient storm-fronts. These pets lack traditional solid forms, existing as gaseous entities.

### Saturn: The Diamond Crown
* **Power / Type:** Diamond & Pressure
* **Mechanic Style:** Fast-paced Sorting.
* **Primary Interaction:** Players must sift through falling "Diamond Rain," separating pure carbon crystals from carbon soot and debris as they fall through the atmosphere.
* **Pet Archetype:** Geometric, carbon-lattice, glittering "Gem-pets." Their forms are rigid, crystalline, and reflect light in high-contrast sprites.

### Uranus: The Azure Tilt
* **Power / Type:** Magnetism & Tilt
* **Mechanic Style:** Logic Puzzler.
* **Primary Interaction:** Realigning skewed magnetic fields by rotating logic gates to guide a pet safely through a polar blizzard.
* **Pet Archetype:** Electric-blue, polar, magnetized-scaled eels. These pets often have "Magnetic" abilities that can disrupt opponent turns in combat.

### Neptune: The Psionic Abyss
* **Power / Type:** Sonic & Abyss
* **Mechanic Style:** Audio-Visual Memory.
* **Primary Interaction:** Identifying specific predator sound frequencies to navigate a pet through the pitch-black depths of the planetary ocean.
* **Pet Archetype:** Translucent, gelatinous, "echo-location" whales. They are the primary "Mage" class of the system, focusing on Psionic and Sonic attacks.

### Pluto: The Cryo-Archive
* **Power / Type:** Stasis & Void
* **Mechanic Style:** Idle Management.
* **Primary Interaction:** Managing a "Cryo-Vault" where items are placed to freeze or thaw over real-world time, changing their properties or rarity.
* **Pet Archetype:** Tiny, frozen-solid, prehistoric-style fossils. These pets are durable and slow, often requiring "Thawing" to unlock specific battle moves.

### Earth: The Biome Hub
* **Power / Type:** Nature & Flora
* **Mechanic Style:** Garden Simulation.
* **Primary Interaction:** Cultivating "Universal Food" and "Botanical Ingredients" used for crafting across the other 9 planets. Earth serves as the primary Social and Economic hub.
* **Pet Archetype:** Mammalian, leafy, "classic" companion pets. These are the most versatile pets and serve as the "Starter" species for new accounts.

---

## 4. Technical Constraints & Database Logic
* **Persistence:** Every action is a transaction against an SQLite database.
* **Level-Locking:** The `spawn_table` for each planet is queried against the user's `Global_Level`. (e.g., `SELECT * FROM species WHERE planet_id = 'Saturn' AND min_level <= ?`).
* **The "Travel Delay":** Traveling between planets updates a `current_location_timestamp`. Users cannot interact with planet-specific logic until the travel duration has elapsed, creating a sense of scale.
* **Responsive Web Design:** Built with Tailwind CSS to ensure the "Vanilla Browser" feel works natively on mobile devices via a PWA (Progressive Web App) approach.

## 5. Future Development
* **The Battle Engine:** A turn-based system utilizing Planetary Types (e.g., Solar > Ice, Sonic > Psychic).
* **The Marketplace:** A player-to-player auction house and trading post for rare "Diamond" or "Shadow" variant pets.
* **Planetary Mastery:** A secondary leveling system per-planet that grants permanent buffs when on that specific celestial body.
