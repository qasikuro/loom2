# Cosmic Profile Arrival

A transparent 430 × 900 Rive overlay for the public-profile arrival effect.

- `ProfileArrival` plays once on state-machine entry at 60 fps.
- The gold starfall and blue smoke are rebuilt as layered Rive vectors, using the existing cosmic-animation palette and visual direction.
- The ending blue-hour aura follows the starfall and fades away.
- No character art, profile text, background, scripts, or external assets are embedded.
- `generate.mjs` regenerates `scene.rml`; the compiled runtime file is copied to `artifacts/sky-journal/assets/rive/profile_cosmic_arrival.riv`.

Build and inspect with the Rive CLI:

```sh
export PATH="$HOME/.rive/bin:$PATH"
node generate.mjs
rive . --verify
rive inspect . --summary
rive . --once
```
