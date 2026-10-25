# SakuraPay — Landing Page (React + Vite + hls.js)

The public landing / live-demo page for **SakuraPay**, the payment processing
reliability simulator. Full-screen live HLS video background, glassmorphic
navigation, hero pinned bottom-left, and a live telemetry card — rebranded
from the Auroracast HLS landing template (sakura-pink signal accent, Tokyo
ledger-node framing).

The page itself is the demo surface: the background stream and the
bottom-right telemetry (protocol / resolution / bitrate / buffer / ABR
ladder) are real, live values from the playing HLS stream.

## Run

**Run order for the full demo: backend first, then this page.** Start the
SakuraPay API (see the repository root `README.md` — quick start, including
a Windows PowerShell version), then:

```bash
npm install
npm run dev      # dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # serve the production build
```

On Windows PowerShell the same commands work as-is — run them one per line.

## What it demonstrates

- **Full-screen HLS background** — `hls.js` (MSE) with native-HLS fallback
  for Safari and an ordered fallback chain of public test streams.
- **Glassmorphic nav** — frosted pill header with a working mobile drawer
  (Escape closes it).
- **Hero, bottom-left** — staggered line reveal: "Every payment, settled
  exactly once."
- **Live telemetry** — real stream stats from hls.js events, plus a mute
  toggle for the background video.
- Responsive (desktop / tablet / phone) and honors `prefers-reduced-motion`.

## Backend

The SakuraPay API this page introduces is the FastAPI project in the
`sakura_pay` repository: idempotent payments, balanced ledger, HMAC
webhooks, reconciliation. Demo accounts are created by
`scripts/seed_demo.py` in that project.

`demo.mp4` / `poster.jpg` are preview assets for this README only; the page
streams its background from public HLS test sources at runtime.
