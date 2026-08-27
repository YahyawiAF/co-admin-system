# Coworking desk ↔ ERP Simple (supply-chainpro) bridge

## Co-admin (this project)

On **Finance → Clôturer**, the backend posts a day-close payload when:

```env
ERP_SYNC_ENABLED=true
ERP_API_URL=http://localhost:3000   # supply-chainpro Nest API
ERP_ORG_ID=<organization-uuid>      # RETAIL Simple org in ERP
```

Payload shape (also available via `GET /caisse/erp-payload-preview?date=YYYY-MM-DD`):

```json
{
  "source": "collabora-hub",
  "channel": "coworking",
  "organizationId": "...",
  "date": "2026-08-26",
  "revenueJournal": 0,
  "revenueAbonnements": 0,
  "revenueProducts": 0,
  "expenses": 0,
  "countedCash": 0,
  "expectedCash": 0,
  "difference": 0,
  "occupancy": {},
  "overflowUsed": 0
}
```

Clôture succeeds even if ERP is down (soft-fail).

## ERP (supply-chainpro)

- Public route: `POST /coworking/:organizationId/day-close`
- Stub returns `{ externalRef }` for co-admin to store on `CaisseSession`
- Next step: map into Simple Caisse / Order so mobile Pilotage & Caisse show the day

## Ops events (analytics)

Co-admin records `OpsEvent` rows (`seat.assigned`, `seat.overflow_used`, `caisse.closed`, …) via `GET /ops-events`.
