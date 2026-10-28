# business-manager-core

The part of the Conseiller that can be copied into another project as is.
Plain TypeScript: no database, no NestJS, no host table names.

| File | What it does |
|---|---|
| `types.ts` | `MoneyFacts` (what the host app knows), `AnswerRecord` (what the owner answered), `MoneyPlan` |
| `questions.ts` | The questions the manager asks, best first. Skips what the app knows, asks again when an answer is old |
| `money.ts` | Keep / invest calculation. Deterministic and unit-tested |
| `features.ts` | When the manager asks for a tool, and the ticket text once the owner approves |

## Using it in another project

1. Copy this folder.
2. Write an adapter that builds `MoneyFacts` from that project's tables
   (co-admin's adapter: `src/modules/advisor/manager.service.ts`).
3. Store answers as rows `{ key, value, label, note, unknown, answeredAt }` (co-admin: `BusinessAnswer`).
4. Run `npx jest src/business-manager-core` to check the formulas.

Business-specific ideas (e.g. "soirées révision" for a coworking) stay in the adapter, not here.
