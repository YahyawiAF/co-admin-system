#!/usr/bin/env node
/**
 * Export the month forecast and every number behind it, to study the method.
 * Read only: it never writes to the database. Same files as Finance → Prévision
 * → Exporter, without going through the app.
 *
 * Usage (from backend/, after `npm run build`):
 *   node scripts/export-forecast.cjs              # current month
 *   node scripts/export-forecast.cjs 2026-11      # a given month
 *   node scripts/export-forecast.cjs 2026-11 out  # output folder (default: ./forecast-export)
 *
 * Writes, for month M:
 *   forecast-M.json             everything: forecast, rules, base days, calendar
 *   forecast-M-days.csv         one row per day: expected vs real, by tarif / café / abonnements / events
 *   forecast-M-base.csv         the days the weekday averages come from
 *   forecast-M-history.csv      every day of the 2 months before M
 *   forecast-M-abonnements.csv  abonnements ending in M and whether they renewed
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
loadEnvFile(path.join(__dirname, "..", ".env"));
process.env.TZ = process.env.TZ || "Africa/Tunis";

const DIST = path.join(__dirname, "..", "dist", "src", "modules", "analytics", "forecast-export.js");
if (!fs.existsSync(DIST)) {
  console.error(`Build missing (${DIST}). Run "npm run build" first.`);
  process.exit(1);
}
const { PrismaClient } = require("@prisma/client");
const { buildForecastExport } = require(DIST);

async function main() {
  const [monthArg, outArg] = process.argv.slice(2);
  const now = new Date();
  const [year, month] = monthArg ? monthArg.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  if (!year || !month || month < 1 || month > 12) throw new Error(`Bad month "${monthArg}", expected YYYY-MM`);
  const outDir = path.resolve(outArg || "forecast-export");
  fs.mkdirSync(outDir, { recursive: true });

  const prisma = new PrismaClient();
  try {
    const facility = process.env.FACILITY_ID
      ? await prisma.facility.findUnique({ where: { id: process.env.FACILITY_ID }, select: { id: true, name: true } })
      : await prisma.facility.findFirst({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
    if (!facility) throw new Error("No facility found (set FACILITY_ID)");

    const x = await buildForecastExport(prisma, facility.id, year, month, now);
    const files = {
      [`forecast-${x.tag}.json`]: JSON.stringify(x.json, null, 2),
      [`forecast-${x.tag}-days.csv`]: x.csv.days,
      [`forecast-${x.tag}-base.csv`]: x.csv.base,
      [`forecast-${x.tag}-history.csv`]: x.csv.history,
      [`forecast-${x.tag}-abonnements.csv`]: x.csv.abonnements || "aucun abonnement ne finit ce mois\n",
    };
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), content);

    const f = x.json.forecast;
    const t = f.toDate;
    console.log(`${facility.name} · ${f.period.label}`);
    console.log(`  Prévu passes + café ${f.expected.variable} DT · abonnements ${f.expected.subscriptions} DT · événements ${f.events.projected} DT`);
    if (t) {
      console.log(`  À ce jour (${t.days} j) : réel ${t.actual} vs prévu ${t.expected} (${t.gapPct ?? "—"} %)`);
      console.log(`  Fin de mois : ${f.projectedAll.current} DT (méthode actuelle) · ${f.projectedAll.pace} DT (rythme du mois)`);
    }
    if (f.versusPrevious) console.log(`  ${f.period.previousLabel} : ${f.versusPrevious.previousTotal} DT (à calendrier égal ${f.versusPrevious.previousAdjusted})`);
    console.log(`  Files in ${outDir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
