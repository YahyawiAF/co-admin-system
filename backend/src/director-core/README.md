# director-core

The Directeur's portable part: Claude is the brain, the host app gives it eyes (what it
measures by itself) and legs (what it can do). Plain TypeScript: no database, no NestJS,
no host words. Copy this folder into another project (e.g. the ERP) as is.

| File | What it does |
|---|---|
| `catalogue.ts` | `EyeSpec` (a number the app can measure day by day), `LegSpec` (an action), param checks |
| `watch.ts` | The one measuring rule: days since the start vs the same weekdays of the 4 weeks before, plus the sales of the approved drafts, calendar periods flagged |
| `formats.ts` | `directeur/v2` export and `directeur-update/v2` answer: priorities with steps, legs (drafts to approve) and watches, looks, needs. Nothing unknown is applied |
| `lessons.ts` | Lessons the director keeps after challenging a text: verdicts (adopt, adapt, test, reject, same), starting confidence, which lessons go into an export (`pickLessons`), review / promote flags, the `directeur-lessons/v1` file to share principles between projects |
| `memory.ts` | Memory notes (décision, fait, leçon, test), corner ids, the « date \| type \| coin \| texte » import |
| `alert.ts` | Money-drop alert: last 7 days vs the same weekdays before |

## The loop

1. The app exports one JSON: memory, catalogue of eyes and legs, priorities with their watches
   measured, 8 weeks of days, answers to the brain's looks, needs.
2. Claude answers `directeur-update/v2`.
3. The app checks it (`parseUpdate`), shows the changes, saves: priorities replace the active ones,
   drafts wait for the owner's OK, watches start measuring by themselves, needs become feature requests,
   verdicts on the texts to learn become lessons, results move their confidence.

## Using it in another project

1. Copy this folder.
2. Write the eyes: one entry per number, `compute(params, from, to) → EyeDay[]`
   (co-admin: `src/modules/advisor/director-eyes.ts`).
3. Write the legs and `checkLeg` with the same rules as the project's create forms.
4. Store priorities and watches (co-admin: `director_priorities`, `director_watches`).
5. Call `updateInstructions('<the business in a few words>')` in the export.
6. `npx jest src/director-core`.
