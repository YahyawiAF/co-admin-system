# Urgent features before UI rewrite

Product decisions for Collabora Hub coworking admin + visitor mobile, implemented on NestJS + Next/MUI **before** any shadcn/Tailwind migration.

## 1. Problem / context

- **Admin desk**: manage daily check-in/out (Journal), rates, members, subscriptions.
- **Visitor mobile**: scan a reception QR → check in for today or buy a subscription, see a timer and how tarifs work.
- **Stack now**: Next.js 14 + MUI 5 (Front-end), NestJS + Prisma + PostgreSQL (backend).
- **Later**: shadcn + Tailwind rewrite of the UI only; these features must survive that move.

## 2. Decisions locked

| Topic | Choice |
|--------|--------|
| QR flow | Fixed reception QR → visitor opens `/m` on phone |
| Day visit signup | Phone required; password optional |
| Subscription signup | Phone + password required |
| Pricing | Collabora Hub list below |
| Timer | Day packs = countdown + fixed price; subscriptions = days remaining |
| Overstay | Banner after pack ends; keep pack price until checkout; admin can edit amount |
| Active sub check-in | Journal at **0 DT** while subscription is valid |
| Root `/` | Redirect: authenticated → `/dashboard/landing`, else → `/auth/sign-in` |
| Admin home | `/dashboard/landing` |

## 3. Collabora Hub tarif catalog (seed)

### Journée (PACK)

| Name | Hours | Price (DT) |
|------|-------|------------|
| 2h | 2 | 2.8 |
| 4h | 4 | 4.5 |
| Demi-journée (6h) | 6 | 6 |
| Journée (12h) | 12 | 9 |

### Abonnement (PERIOD)

| Name | Days | Half/Full | Price (DT) |
|------|------|-----------|------------|
| Abonnement semaine (demi-journée) | 7 | demi | 35 |
| Abonnement semaine (journée) | 7 | journée | 45 |
| Abonnement 2 semaines (demi-journée) | 14 | demi | 65 |
| Abonnement 2 semaines (journée) | 14 | journée | 80 |
| Abonnement 1 mois (demi-journée) | 30 | demi | 120 |
| Abonnement 1 mois (journée) | 30 | journée | 150 |

### Salle de réunion

| Name | Billing | Price |
|------|---------|-------|
| Salle de réunion | HOURLY | 10 DT/h |
| Salle journée | PACK 12h | 50 DT |

### Open space

| Name | Billing | Price |
|------|---------|-------|
| Open space | HOURLY | 25 DT/h |
| Open space journée | PACK 12h | 140 DT |

## 4. Admin UX

### Landing

- `/dashboard/landing` = admin dashboard (who’s here counts, cash, etc.).
- `/` empty template → redirect to landing or sign-in.

### Journal (easy check-in)

- Search member by **name or phone**.
- One-tap **check-in** with selected Journée pack.
- Inline **new member** (first name + phone) without leaving the page.
- One-click **check-out** (`leaveTime = now`).
- Desk focus: **Who’s here · Check in · Check out**.

### Rates

- Structured create: category + billing unit + duration/period + price.
- Button **Load Collabora Hub tarifs** to seed missing catalog rows.

## 5. Mobile QR UX (`/m`)

| Route | Role |
|--------|------|
| `/m` | Choose: Visite du jour / Abonnement |
| `/m/signup` | Phone (+ password if subscription) |
| `/m/choose` | Pick pack or subscription plan |
| `/m/session` | Active day session: countdown + amount + checkout |
| `/m/subscription` | Active plan + validity dates |
| `/m/tarifs` | Explain pricing (poster sections + plain rules) |

**Bottom nav:** Session · Abonnement · Tarifs  

**Admin confirmation:** After the visitor picks a pack/plan, a **pending visit request** is created. The admin bell shows it with **Confirm / Reject**. Session or subscription starts only after Confirm. The mobile screen waits (“En attente de confirmation”).

**QR:** points to `{NEXT_PUBLIC_APP_URL}/m` (printable from admin facility/landing).

**French copy** on visitor-facing screens.

## 6. Timer & billing rules

- **Day pack:** `Journal` with `registredTime`, `priceId`, expected end = start + `durationHours`; UI countdown; amount = pack price.
- **Hourly (salle / open space):** elapsed timer; amount ≈ `ceil(hours) * rate` (admin or future mobile booking).
- **Subscription:** `Abonnement` with `registredDate` / `leaveDate` from `periodDays`; show days left; no day countdown.
- **Resume day session:** look up open journal for phone today (no SMS/OTP in this pass).

## 7. Data model extensions

### `Price`

- `category`: `JOURNEE | ABONNEMENT | SALLE | OPEN_SPACE`
- `durationHours`: Float? (packs / hourly reference)
- `billingUnit`: `PACK | HOURLY | PERIOD`
- `periodDays`: Int? (7 / 14 / 30)

Keep existing `type` (`journal` | `abonnement`) for compatibility.

### `Member`

- `passwordHash` String? (required when using subscription auth)
- Prefer storing `phone` as string for leading zeros; migrate `Int?` → `String?` if needed for signup UX

### APIs

- Member mobile auth: register / login by phone
- Start day session / checkout
- Start subscription
- Active session + active subscription for member
- Seed Collabora prices
- Quick check-in / checkout for admin

## 8. Out of scope (this pass)

- Full shadcn + Tailwind redesign
- Seats.io map redesign
- SMS / OTP verification

## 9. Residual defaults

- Overstay: overtime banner, pack price held, admin can adjust at checkout.
- Change later only if product wants auto-upgrade to next journée pack.
