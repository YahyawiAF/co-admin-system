/** Captions shown over the screen recording, keyed by recorder marker names (record.ts). */
export type Caption = { chip: string; title: string; sub: string; chapter: number };

export const CHAPTERS = ["Check in", "During", "Leave", "Next visit"];

export const SCAN_CAPTION: Caption = {
  chip: "Step 1",
  title: "Scan the QR at the entrance",
  sub: "Just use your phone's camera.",
  chapter: 0,
};

export const CAPTIONS: Record<string, Caption> = {
  welcome: { chip: "Step 1", title: "The check-in page opens", sub: "Right in your browser. Nothing to install.", chapter: 0 },
  phone: { chip: "Step 2", title: "Type your phone number", sub: "That's your account. No password.", chapter: 0 },
  name: { chip: "Step 3", title: "First visit? Add your name", sub: "Only the very first time.", chapter: 0 },
  checkedIn: { chip: "Done", title: "You're checked in!", sub: "Auto rate is on: you pay only for the time you stay.", chapter: 1 },
  session: { chip: "Live", title: "Follow your session", sub: "Time spent, price and your next pass.", chapter: 1 },
  tarif: { chip: "Optional", title: "Prefer a fixed price? Tap “Fixer”", sub: "Pick a pass: 2h, 4h, half day or full day.", chapter: 1 },
  tarifSet: { chip: "Optional", title: "Your pass is locked", sub: "Price set in advance. You can change it until you pay.", chapter: 1 },
  qr: { chip: "Tip", title: "Need a seat? Open “Mon QR”", sub: "Reception picks your place and scans your code.", chapter: 1 },
  end: { chip: "Leaving", title: "Tap “Terminer ma session”", sub: "Then pay at reception.", chapter: 2 },
  home: { chip: "Next visit", title: "One tap to check in", sub: "Tap “Pointer mon arrivée”, or scan the QR again.", chapter: 3 },
  done: { chip: "Next visit", title: "You're in. That fast.", sub: "Your session starts right away.", chapter: 3 },
};

/** Gentle zooms on the phone: start/end are seconds after the marker. */
export const ZOOMS: Record<string, { start: number; end: number; scale: number; origin: string }> = {
  session: { start: 0.5, end: 4.2, scale: 1.14, origin: "50% 20%" },
  tarif: { start: 2.0, end: 4.6, scale: 1.08, origin: "50% 72%" },
  tarifSet: { start: 0.4, end: 3.6, scale: 1.14, origin: "50% 20%" },
  qr: { start: 1.6, end: 5.2, scale: 1.1, origin: "50% 62%" },
};

export type Markers = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  markers: { name: string; at: number }[];
};
