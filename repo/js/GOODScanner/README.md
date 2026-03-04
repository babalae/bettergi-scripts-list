# GOOD Scanner

Scan your Genshin Impact characters, weapons, and artifacts using BetterGI's built-in OCR, and export in **GOOD v3** (Genshin Open Object Description) format — compatible with [Genshin Optimizer](https://frzyc.github.io/genshin-optimizer/) and other tools.

## Features

- **Character scanning**: Level, ascension, talent levels (auto/skill/burst), constellation count
- **Weapon scanning** (3-5★): Level, ascension, refinement, lock status, equipped character
- **Artifact scanning** (4-5★): Level, rarity, main stat, sub stats (key + value), inactive sub stats, lock status, astral mark, elixir crafted, equipped character
- **GOOD v3 output**: Standard JSON format importable by Genshin Optimizer, SEELIE.me, etc.
- **Configurable**: Choose which categories to scan and minimum rarity thresholds

## Requirements

- BetterGI v0.44.3 or later
- Game running at **1920×1080** resolution
- Game language: **Chinese (Simplified)**

## Usage

1. Make sure the game is at the **main screen** (not in a menu or domain)
2. Run the script from BetterGI
3. The script will automatically navigate through character/weapon/artifact screens
4. Output JSON is saved to `records/good_export_<timestamp>.json`
5. Import the JSON file into Genshin Optimizer via Settings → Database → Import

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Scan Characters | ✓ | Scan all characters |
| Scan Weapons | ✓ | Scan all weapons |
| Scan Artifacts | ✓ | Scan all artifacts |
| Min Weapon Rarity | 3 | Minimum weapon star rating to include |
| Min Artifact Rarity | 4 | Minimum artifact star rating to include |

## Output Format

The exported JSON follows the [GOOD v3 specification](https://frzyc.github.io/genshin-optimizer/#/doc):

```json
{
  "format": "GOOD",
  "version": 3,
  "source": "BetterGI-GOODScanner",
  "characters": [...],
  "weapons": [...],
  "artifacts": [...]
}
```

## Notes

- Scanning a full inventory (90+ characters, 200+ weapons, 1500+ artifacts) may take 30-60 minutes
- OCR accuracy depends on game resolution and graphics settings — 1920×1080 is recommended
- The script uses fuzzy matching for name recognition to handle minor OCR errors
- Traveler is exported as `"Traveler"` without element suffix (Genshin Optimizer handles this)
- Sub-stats marked as "待激活" (inactive) are exported in the `unactivatedSubstats` field
