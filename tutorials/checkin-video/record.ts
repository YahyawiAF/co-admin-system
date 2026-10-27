/**
 * Records the visitor check-in flow in a phone-sized browser.
 *
 * Output:
 *   public/screen.mp4    crisp 30 fps screen recording at 3× pixel density
 *   public/markers.json  when each tutorial step starts (seconds into screen.mp4)
 *
 * Needs the web app (:3001) and API (:5000) running. Creates a demo visitor
 * with a fake phone number in the local database.
 */
import { chromium, devices, type Locator, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3001";
const ORG = process.env.ORG ?? "collabora-hub";
// Fake demo number; each run needs an unused one (a known number skips the sign-up step).
const PHONE = process.env.PHONE ?? `5${String(Date.now()).slice(-7)}`;
const NAME = process.env.NAME ?? "Sarra Ben Ali";
// Pass picked in the tarif step (its short label in the sheet: 2h, 4h, 6h, Jour).
const TARIF = process.env.TARIF ?? "4h";
const SPACE_NAME = process.env.SPACE_NAME ?? "Collabora Hub";
// Text to hide on screen (local test data), replaced by SPACE_NAME.
const HIDE_TEXT = (process.env.HIDE_TEXT ?? "Abdel fatteh yahyawi").toLowerCase();

const FPS = 30;
const RAW = path.resolve("raw");
const FRAMES = path.join(RAW, "frames");

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync("public", { recursive: true });

/** Runs in the page: tap ripple, gliding fingertip, hide dev badge, swap test name. */
const pageSetup = ({ hide, space }: { hide: string; space: string }) => {
  const css = `
    nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
    .rec-finger { position: fixed; z-index: 2147483647; width: 46px; height: 46px; margin: -23px 0 0 -23px;
      border-radius: 50%; background: rgba(255,255,255,.55); border: 2px solid rgba(79,70,229,.55);
      box-shadow: 0 6px 18px rgba(30,27,75,.25); pointer-events: none; opacity: 0;
      transition: opacity .2s ease, transform .12s ease; }
    .rec-finger.on { opacity: 1; }
    .rec-finger.down { transform: scale(.82); background: rgba(199,210,254,.75); }
    .rec-ripple { position: fixed; z-index: 2147483646; width: 46px; height: 46px; margin: -23px 0 0 -23px;
      border-radius: 50%; border: 3px solid rgba(99,102,241,.8); pointer-events: none;
      animation: rec-ripple .55s ease-out forwards; }
    @keyframes rec-ripple { from { transform: scale(.6); opacity: 1 } to { transform: scale(2.4); opacity: 0 } }
  `;
  const swap = (root: Node) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const v = n.nodeValue;
      if (v && v.toLowerCase().includes(hide)) {
        n.nodeValue = v.replace(new RegExp(hide.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), space);
      }
    }
  };
  const boot = () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    const finger = document.createElement("div");
    finger.className = "rec-finger";
    document.body.appendChild(finger);
    addEventListener("mousemove", (e) => {
      finger.style.left = `${e.clientX}px`;
      finger.style.top = `${e.clientY}px`;
      finger.classList.add("on");
    }, true);
    addEventListener("mousedown", (e) => {
      finger.classList.add("down");
      const r = document.createElement("div");
      r.className = "rec-ripple";
      r.style.left = `${e.clientX}px`;
      r.style.top = `${e.clientY}px`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    let idle: ReturnType<typeof setTimeout> | undefined;
    addEventListener("mouseup", () => {
      finger.classList.remove("down");
      clearTimeout(idle);
      idle = setTimeout(() => finger.classList.remove("on"), 700);
    }, true);
    swap(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") swap(m.target);
        m.addedNodes.forEach(swap);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot);
  else boot();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Glide the fingertip to an element and tap it. */
async function tap(page: Page, target: Locator, yAt = 0.5) {
  await target.waitFor({ state: "visible", timeout: 20000 });
  // Animated elements never count as "stable"; they are already on screen anyway.
  await target.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
  const box = await target.boundingBox();
  if (!box) throw new Error("element has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height * yAt;
  await page.mouse.move(x, y, { steps: 22 });
  await sleep(350);
  await page.mouse.down();
  await sleep(110);
  await page.mouse.up();
}

async function smoothScroll(page: Page, dy: number, ms = 900) {
  await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), dy);
  await sleep(ms);
}

// Forcing 3× rendering makes the screencast send full-resolution frames.
const browser = await chromium.launch({ args: ["--force-device-scale-factor=3"] });
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Africa/Tunis" });
// tsx wraps inner functions in __name(); define it in the page so pageSetup can run there.
await ctx.addInitScript({ content: "globalThis.__name = (f) => f;" });
await ctx.addInitScript(pageSetup, { hide: HIDE_TEXT, space: SPACE_NAME });
const page = await ctx.newPage();

// Warm up (compile routes) before recording so nothing shows a dev-server spinner.
for (const p of ["", "/entry", "/session"]) {
  await page.goto(`${BASE}/m/${ORG}${p}`, { waitUntil: "networkidle" }).catch(() => {});
}
await ctx.clearCookies();
await page.evaluate(() => localStorage.clear());
await page.goto("about:blank");

// --- Screen capture via CDP screencast ---
const cdp = await ctx.newCDPSession(page);
const frames: { file: string; t: number }[] = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = path.join(FRAMES, `${String(frames.length).padStart(5, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

const markers: { name: string; at: number }[] = [];
const mark = (name: string) => {
  markers.push({ name, at: Date.now() / 1000 });
  console.log("●", name);
};

await page.goto(`${BASE}/m/${ORG}/entry`);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1600, maxHeight: 3200, everyNthFrame: 1 });
const t0 = Date.now() / 1000;

try {
  // 1. QR scan opens the entry link → welcome screen
  mark("welcome");
  const phoneInput = page.locator('input[type="tel"]');
  await phoneInput.waitFor({ timeout: 30000 });
  await sleep(1800);

  // 2. Phone number
  mark("phone");
  await tap(page, phoneInput);
  await phoneInput.pressSequentially(PHONE, { delay: 110 });
  await sleep(700);
  await tap(page, page.getByRole("button", { name: "Continuer" }));

  // 3. First visit: name
  const nameInput = page.locator('input[autocomplete="name"]');
  await nameInput.waitFor({ timeout: 20000 });
  mark("name");
  await sleep(600);
  await nameInput.pressSequentially(NAME, { delay: 85 });
  await sleep(600);
  await tap(page, page.getByRole("button", { name: "Entrer" }));

  // 4. Checked in: reward sheet with the daily quote
  const seeSession = page.getByRole("button", { name: "Voir ma session" });
  await seeSession.waitFor({ timeout: 30000 });
  mark("checkedIn");
  await sleep(4800);
  await tap(page, seeSession);

  // 5. Live session panel
  await sleep(700);
  mark("session");
  await sleep(3200);

  // 6. Optional: fix a pass instead of the auto rate
  mark("tarif");
  await tap(page, page.getByRole("button", { name: "Changer de tarif" }));
  const sheet = page.getByRole("dialog");
  const pass = sheet.getByRole("button", { name: new RegExp(`^${TARIF}\\b`) }).first();
  await pass.waitFor({ timeout: 10000 });
  await sleep(1800);
  await tap(page, pass);
  await sleep(1400);
  await tap(page, sheet.getByRole("button", { name: /^Valider/ }));
  // The closed sheet stays in the DOM, so wait for the "Pass … choisi" toast instead.
  await page.getByText(/choisi/).first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(400);
  mark("tarifSet");
  await sleep(3600);

  // 7. Mon QR
  const qrBtn = page.getByRole("button", { name: /Mon QR/ }).first();
  await smoothScroll(page, 520, 1100);
  mark("qr");
  await tap(page, qrBtn);
  await sleep(3800);
  const closeQr = page.locator('button[aria-label="Fermer"]:visible').first();
  // Only the top edge of this X is tappable: the sheet title overlaps the rest (QuestSheet).
  await tap(page, closeQr, 0.22);
  await closeQr.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  await sleep(700);

  // 8. Leaving: end the session
  const endBtn = page.getByRole("button", { name: "Terminer ma session" });
  await endBtn.scrollIntoViewIfNeeded();
  mark("end");
  await sleep(500);
  await tap(page, endBtn);
  await sleep(1300);
  await tap(page, page.getByRole("button", { name: "Terminer", exact: true }));
  await sleep(1800);

  // 9. Next visit: one tap from home
  await tap(page, page.getByRole("link", { name: "Retour à l'accueil" }).or(page.getByRole("button", { name: "Retour à l'accueil" })).first());
  const oneTap = page.getByRole("button", { name: "Pointer mon arrivée" });
  await oneTap.waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  mark("home");
  await sleep(2200);
  await tap(page, oneTap);
  await page.waitForURL(/session/, { timeout: 20000 });
  mark("done");
  await sleep(3500);
} catch (e) {
  await page.screenshot({ path: path.join(RAW, "failure.png") }).catch(() => {});
  throw e;
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  await sleep(300);
  // Leave the demo visitor checked out (not recorded).
  try {
    await page.goto(`${BASE}/m/${ORG}/session`);
    await page.getByRole("button", { name: "Terminer ma session" }).click({ timeout: 8000 });
    await page.getByRole("button", { name: "Terminer", exact: true }).click({ timeout: 8000 });
    await sleep(1500);
  } catch {
    console.warn("! could not end the demo session — end it from the admin journal");
  }
  await browser.close();
}

const tEnd = markers.length ? markers[markers.length - 1].at + 3.5 : Date.now() / 1000;
if (frames.length < 10) throw new Error(`only ${frames.length} frames captured`);

// Each frame lasts until the next one.
const lines = ["ffconcat version 1.0"];
frames.forEach((f, i) => {
  const next = frames[i + 1]?.t ?? tEnd;
  // Exact timing; ffmpeg resamples to a constant 30 fps (dropping extra frames).
  const dur = Math.max(0.001, next - f.t);
  lines.push(`file '${f.file}'`, `duration ${dur.toFixed(4)}`);
});
lines.push(`file '${frames[frames.length - 1].file}'`);
const list = path.join(RAW, "frames.ffconcat");
writeFileSync(list, lines.join("\n"));

const firstFrame = frames[0].t;
// Frame size from the JPEG header (SOF0), rounded to even numbers for H.264.
const jpg = readFileSync(frames[0].file);
const sof = jpg.indexOf(Buffer.from([0xff, 0xc0]));
const W = jpg.readUInt16BE(sof + 7) & ~1;
const H = jpg.readUInt16BE(sof + 5) & ~1;
execFileSync(
  "npx",
  [
    "remotion", "ffmpeg", "-y", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", list,
    "-vf", `scale=${W}:${H}`, "-r", String(FPS), "-fps_mode", "cfr",
    "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
    "public/screen.mp4",
  ],
  { stdio: "inherit" },
);

const out = {
  fps: FPS,
  width: W,
  height: H,
  duration: +(tEnd - firstFrame).toFixed(3),
  markers: markers.map((m) => ({ name: m.name, at: +Math.max(0, m.at - firstFrame).toFixed(3) })),
};
writeFileSync("public/markers.json", JSON.stringify(out, null, 2));
console.log(`✓ ${frames.length} frames, ${out.duration}s (screencast started ${(firstFrame - t0).toFixed(2)}s after start)`);
console.log(out.markers);
