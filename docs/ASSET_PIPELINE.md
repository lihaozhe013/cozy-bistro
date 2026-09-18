# Asset Pipeline

This document describes the current visual asset workflow for the root 2D game.
It consolidates the older character notes and broad art-upgrade plan.

## Source and generated assets

[`scripts/generate_atlases.py`](../scripts/generate_atlases.py) generates the
runtime atlases consumed by Phaser:

- `src/assets/atlases/furniture.png` and `.json`
- `src/assets/atlases/characters.png` and `.json`
- `src/assets/atlases/environment.png` and `.json`
- `src/assets/atlases/ui-icons.png` and `.json`

The generator is the source for procedural furniture, environment, and fallback
character art. `src/data/visualAssets.ts` is the runtime registry for frame
names, scale, origins, and metadata.

## Character input priority

For each role, action, facing, and variant, the generator checks:

1. `src/assets/ai_characters/`
2. `src/assets/lpc_characters/` when an LPC sheet is supplied
3. procedural Pillow rendering

AI character filenames use the most-specific matching path first:

```text
{role}-v{variant}-{facing}.png
{role}-v{variant}.png
{role}-{facing}.png
{role}.png
```

AI inputs should be transparent PNGs with one full-body character. They may be
any source size because the generator trims and scales them into the atlas.
The current repository contains generated AI character inputs; LPC remains an
optional fallback source rather than a required dependency.

## Art direction rules

- Keep the existing atlas frame names and metadata stable unless the loader and
  all generated outputs are updated together.
- Prefer original cozy shapes, warm materials, consistent outlines, contact
  shadows, and readable silhouettes.
- Use runtime `Graphics` for dynamic overlays such as selection states,
  placement previews, plates, bubbles, and other state-dependent effects.
- Use atlas art for repeated furniture, characters, environment pieces, and
  UI icons.
- Avoid introducing copyrighted or upstream-identical assets.
- Improve the most visible repeated assets first: characters, tables/chairs,
  kitchen equipment, status icons, then floor and wall materials.

## Regeneration and verification

From the repository root:

```bash
python scripts/generate_atlases.py
pnpm run typecheck
pnpm test
pnpm run build
```

Generated atlases are committed runtime inputs. After regenerating them,
manually inspect the game for scale, anchor, facing, seated characters,
placement previews, and save/load behavior. Headless tests do not verify canvas
pixels.

## Future art work

The next visual pass should add a coherent palette/style system and improve
silhouette/detail consistency without changing gameplay, grid behavior, save
format, or atlas contracts. Hand-authored replacements can be introduced
incrementally if they preserve the same runtime registry.
