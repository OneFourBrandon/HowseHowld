# Ledger redesign canvas

Source for the HowseHowld redesign canvas (the dark "Night" direction taken from Ashton's Dribbble reference, with
pill navigation, Manrope and a motion system). Nothing here is loaded by the app; it is the
design deliverable and the files the canvas was generated from.

- `lib.mjs` – tokens, fonts, shared CSS (including the motion system), icon set,
  components, sample data mirroring `src/data/demo.ts`.
- `screens-desktop.mjs` – Overview, Chores, Money, Calendar, Driveway, Settings.
- `screens-more.mjs` – Sign in, phone screens, Add purchase modal, design system
  sheet, two low-fi alternate directions.
- `screens-motion.mjs` – the Motion sheet (twelve looping micro-interaction demos
  with timing and easing) and the proposed command palette.
- `build.mjs` – writes every artboard to `artboards/` plus `canvas.json`.

Regenerate the artboards with:

```powershell
node design/ledger/build.mjs
```

Then re-seed and republish the canvas by running `/design` in Claude Code and
pointing it at `artboards/`. Edits made in the published canvas are saved online;
to bring them back here, read the artifact and extract it with the same skill.
