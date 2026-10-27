# Check-in tutorial video

A vertical (1080×1920) video that shows visitors how to check in with the `/m` app:
scan the QR, type a phone number (plus a name on the first visit), follow the session,
show "Mon QR", end the session, then check in again with one tap.

The finished video is [checkin-tutorial.mp4](checkin-tutorial.mp4). It also shows the optional
tarif step: tap "Fixer" and lock a pass (4h by default) instead of the auto rate.

The video uses a real recording of the app, so re-record it whenever the visitor screens change.

## Make the video

1. Start the app: the API on :5000 and the web app on :3001 (`.claude/launch.json`: `co-admin-api` and `co-admin-web`).
2. In this folder:

```bash
npm install
npx playwright install chromium
npm run record   # records the flow → public/screen.mp4 + public/markers.json
npm run render   # → out/checkin-tutorial.mp4
cp out/checkin-tutorial.mp4 checkin-tutorial.mp4   # update the committed copy
```

`npm run studio` opens the Remotion editor to preview it.

## Notes

- Each recording creates a demo visitor with a fake phone number (`5xxxxxxx`) in the local database and checks it out at the end.
- Options (environment variables): `ORG` (default `collabora-hub`), `NAME`, `TARIF` (pass picked in the tarif step, default `4h`), `PHONE`, `SPACE_NAME`, and `HIDE_TEXT` (a test facility name to replace on screen).
- Captions are in [src/captions.ts](src/captions.ts), keyed by the step markers that [record.ts](record.ts) writes.
- Remotion is free for individuals and companies of up to 3 people; bigger companies need a licence.
