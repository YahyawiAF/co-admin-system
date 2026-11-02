# business-manager-core

The part of the Conseiller that can be copied into another project as is.
Plain TypeScript: no database, no NestJS, no host table names.

| File | What it does |
|---|---|
| `types.ts` | `MoneyFacts` (what the host app knows), `AnswerRecord` (what the owner answered), `MoneyPlan` |
| `questions.ts` | The questions the manager asks, best first. Skips what the app knows, asks again when an answer is old |
| `money.ts` | Keep / invest calculation. Deterministic and unit-tested |
| `forecast.ts` | Month forecast from the 4 weeks before (same weekday average), band, prévu vs réel split into drivers, unexplained 7-day changes |
| `levers.ts` | Lever map engine: each lever (from the host) gets WORKING / IN_PROGRESS / MISSING / NO_DATA / OK from the owner's actions; missing ones become ideas |
| `stock-lots.ts` | Stock by purchase lot: recipes turn sales into ingredient use (first in, first out), each lot's money back and result, what is left, days left, losses from inventory counts |
| `features.ts` | When the manager asks for a tool, and the ticket text once the owner approves |

## Using it in another project

1. Copy this folder.
2. Write an adapter that builds `MoneyFacts` from that project's tables
   (co-admin's adapter: `src/modules/advisor/manager.service.ts`).
3. Store answers as rows `{ key, value, label, note, unknown, answeredAt }` (co-admin: `BusinessAnswer`).
4. Run `npx jest src/business-manager-core` to check the formulas.

Business-specific ideas (e.g. "soirées révision" for a coworking) stay in the adapter, not here.
