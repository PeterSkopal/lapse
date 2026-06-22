# Lapse

A focused interval timer PWA for workouts. Define your laps, exercises and
breaks, hit **Start**, and let the timer guide you with distinct audio cues and
a colour-coded countdown ring.

**Live:** https://peterskopal.github.io/lapse/

## Features

- **Setup in seconds** — laps, exercises per lap, exercise length, break between
  exercises, and break between laps.
- **Big, glanceable display** — phase, seconds to the next milestone, current
  lap and exercise, plus total elapsed time. Each phase has its own colour.
- **Distinct audio cues** — synthesised in the browser (no files, works
  offline): a rising tone when an exercise starts, a soft tone when a break
  starts, a chime when a lap ends, gentle 3-2-1 ticks, and a finish fanfare.
- **Screen stays awake** during a workout (Screen Wake Lock API).
- **Save & reuse workouts** — name a configuration and load it again any time
  (stored locally in your browser).
- **Installable PWA** — add to your home screen and run it fully offline.

## Tech

Vanilla **TypeScript + Vite**, no UI framework. PWA manifest and service worker
via `vite-plugin-pwa`. Audio via the Web Audio API.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run icons      # regenerate PNG icons from public/favicon.svg
```

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` is set to `/lapse/` to match the
project Pages URL.

## Notes & limitations

- **Lowering other apps' audio by 50%:** not implemented because the web
  platform does not expose system-wide audio ducking to web pages/PWAs — only
  native apps can lower other apps' output. Cues are kept short instead.
- **Screen Wake Lock** requires a supporting browser (iOS Safari 16.4+, modern
  Chrome/Edge/Android). It falls back silently where unavailable.
- **Audio on iOS** is unlocked by the Start button tap, as required by Safari.

## License

MIT
