#!/usr/bin/env node
/**
 * Dump / import tarifs (prices) + seat map (facility, spaces, tables,
 * seats, walls, fixtures). Does NOT copy journals, bookings, members.
 *
 * Usage (from backend/):
 *   node scripts/tarif-seatmap.cjs dump [outfile.json]
 *   node scripts/tarif-seatmap.cjs import [infile.json]
 *   node scripts/tarif-seatmap.cjs seed-admin
 * Import also upserts bootstrap admin abdelftt@gmail.com.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcrypt");

const BOOTSTRAP_ADMIN = {
  email: "abdelftt@gmail.com",
  password: "test123!",
  fullname: "Abdelfettah",
  role: Role.ADMIN,
};

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const backendDir = path.resolve(__dirname, "..");
loadEnvFile(path.join(backendDir, ".env"));
loadEnvFile(path.join(backendDir, ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

const args = process.argv.slice(2);
const cmd = args[0];
const dryRun = args.includes("--dry-run");
const fileArg = args.find((a) => a !== cmd && a !== "--dry-run");
const defaultFile = path.join(
  __dirname,
  "data",
  "tarif-seatmap-snapshot.json"
);
const snapshotFile = fileArg
  ? path.resolve(process.cwd(), fileArg)
  : defaultFile;

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function pick(row, keys) {
  const out = {};
  for (const key of keys) out[key] = iso(row[key]);
  return out;
}

async function dump(prisma) {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
  });
  const facilities = await prisma.facility.findMany({
    orderBy: { createdAt: "asc" },
  });
  const spaces = await prisma.space.findMany({
    orderBy: [{ facilityId: "asc" }, { sortOrder: "asc" }],
  });
  const tables = await prisma.table.findMany({
    orderBy: [{ spaceId: "asc" }, { sortOrder: "asc" }],
  });
  const seats = await prisma.seat.findMany({
    orderBy: [{ spaceId: "asc" }, { label: "asc" }],
  });
  const walls = await prisma.spaceWall.findMany({
    orderBy: { createdAt: "asc" },
  });
  let fixtures = [];
  if (prisma.spaceFixture) {
    fixtures = await prisma.spaceFixture.findMany({
      orderBy: { createdAt: "asc" },
    });
  }
  const prices = await prisma.price.findMany({
    orderBy: { createdAt: "asc" },
  });

  const snapshot = {
    exportedAt: new Date().toISOString(),
    organizations: organizations.map((r) =>
      pick(r, ["id", "name", "slug", "logo", "createdAt", "updatedAt"])
    ),
    facilities: facilities.map((r) =>
      pick(r, [
        "id",
        "name",
        "numtel",
        "email",
        "adresse",
        "logo",
        "nbrPlaces",
        "socialNetworks",
        "places",
        "mobileSeatMode",
        "receptionAway",
        "organizationId",
        "createdAt",
        "updatedAt",
      ])
    ),
    spaces: spaces.map((r) =>
      pick(r, [
        "id",
        "facilityId",
        "name",
        "category",
        "floorPlanUrl",
        "sortOrder",
        "capacityNormal",
        "createdAt",
        "updatedAt",
      ])
    ),
    tables: tables.map((r) =>
      pick(r, [
        "id",
        "spaceId",
        "name",
        "imageUrl",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "sortOrder",
        "createdAt",
        "updatedAt",
      ])
    ),
    seats: seats.map((r) =>
      pick(r, [
        "id",
        "spaceId",
        "tableId",
        "label",
        "offsetX",
        "offsetY",
        "isOverflow",
        "isActive",
        "createdAt",
        "updatedAt",
      ])
    ),
    walls: walls.map((r) =>
      pick(r, [
        "id",
        "spaceId",
        "label",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "createdAt",
        "updatedAt",
      ])
    ),
    fixtures: fixtures.map((r) =>
      pick(r, [
        "id",
        "spaceId",
        "kind",
        "label",
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "createdAt",
        "updatedAt",
      ])
    ),
    prices: prices.map((r) =>
      pick(r, [
        "id",
        "name",
        "price",
        "type",
        "category",
        "durationHours",
        "billingUnit",
        "periodDays",
        "spaceId",
        "reserveSeat",
        "timePeriod",
        "createdAt",
        "updatedAt",
      ])
    ),
  };

  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${snapshotFile}`);
  console.log(
    `  orgs=${snapshot.organizations.length} facilities=${snapshot.facilities.length} spaces=${snapshot.spaces.length} tables=${snapshot.tables.length} seats=${snapshot.seats.length} walls=${snapshot.walls.length} fixtures=${snapshot.fixtures.length} prices=${snapshot.prices.length}`
  );
}

function log(msg) {
  console.log(msg);
}

async function upsertOrg(prisma, local, dry) {
  const bySlug = await prisma.organization.findUnique({
    where: { slug: local.slug },
  });
  if (bySlug) {
    if (!dry) {
      await prisma.organization.update({
        where: { id: bySlug.id },
        data: { name: local.name, logo: local.logo },
      });
    }
    log(`  org slug=${local.slug} → keep ${bySlug.id}`);
    return bySlug.id;
  }
  const byId = await prisma.organization.findUnique({
    where: { id: local.id },
  });
  if (byId) {
    if (!dry) {
      await prisma.organization.update({
        where: { id: local.id },
        data: { name: local.name, slug: local.slug, logo: local.logo },
      });
    }
    log(`  org id=${local.id} updated`);
    return local.id;
  }
  if (!dry) {
    await prisma.organization.create({
      data: {
        id: local.id,
        name: local.name,
        slug: local.slug,
        logo: local.logo,
      },
    });
  }
  log(`  org created ${local.slug} ${local.id}`);
  return local.id;
}

async function upsertFacility(prisma, local, orgId, dry, fallbackToFirst) {
  const ofOrg = await prisma.facility.findMany({
    where: { organizationId: orgId },
  });
  const byName = ofOrg.find(
    (f) => f.name.toLowerCase() === local.name.toLowerCase()
  );
  const target =
    byName || (fallbackToFirst && ofOrg.length === 1 ? ofOrg[0] : null);
  const data = {
    name: local.name,
    numtel: local.numtel,
    email: local.email,
    adresse: local.adresse,
    logo: local.logo,
    nbrPlaces: local.nbrPlaces,
    socialNetworks: local.socialNetworks ?? {},
    places: local.places ?? [],
    mobileSeatMode: local.mobileSeatMode,
    receptionAway: local.receptionAway ?? false,
    organizationId: orgId,
  };
  if (target) {
    if (!dry) {
      await prisma.facility.update({ where: { id: target.id }, data });
    }
    log(`  facility "${local.name}" → keep ${target.id}`);
    return target.id;
  }
  const byId = await prisma.facility.findUnique({ where: { id: local.id } });
  if (byId) {
    if (!dry) {
      await prisma.facility.update({ where: { id: local.id }, data });
    }
    log(`  facility id=${local.id} updated`);
    return local.id;
  }
  if (!dry) {
    await prisma.facility.create({ data: { id: local.id, ...data } });
  }
  log(`  facility created ${local.name} ${local.id}`);
  return local.id;
}

async function upsertSpace(prisma, local, facilityId, dry) {
  const existing = await prisma.space.findMany({ where: { facilityId } });
  const match = existing.find(
    (s) => s.name.toLowerCase() === local.name.toLowerCase()
  );
  const data = {
    facilityId,
    name: local.name,
    category: local.category,
    floorPlanUrl: local.floorPlanUrl,
    sortOrder: local.sortOrder ?? 0,
    capacityNormal: local.capacityNormal ?? 0,
  };
  if (match) {
    if (!dry) await prisma.space.update({ where: { id: match.id }, data });
    log(`    space "${local.name}" → keep ${match.id}`);
    return match.id;
  }
  if (!dry) {
    await prisma.space.create({ data: { id: local.id, ...data } });
  }
  log(`    space created "${local.name}"`);
  return local.id;
}

async function upsertTable(prisma, local, spaceId, dry) {
  const existing = await prisma.table.findMany({ where: { spaceId } });
  const match =
    existing.find((t) => t.name === local.name && t.sortOrder === local.sortOrder) ||
    existing.find((t) => t.name === local.name);
  const data = {
    spaceId,
    name: local.name,
    imageUrl: local.imageUrl,
    x: local.x,
    y: local.y,
    width: local.width,
    height: local.height,
    rotation: local.rotation ?? 0,
    sortOrder: local.sortOrder ?? 0,
  };
  if (match) {
    if (!dry) await prisma.table.update({ where: { id: match.id }, data });
    return match.id;
  }
  if (!dry) {
    await prisma.table.create({ data: { id: local.id, ...data } });
  }
  return local.id;
}

async function upsertSeat(prisma, local, spaceId, tableId, dry) {
  const data = {
    spaceId,
    tableId,
    label: local.label,
    offsetX: local.offsetX ?? 0,
    offsetY: local.offsetY ?? 0,
    isOverflow: !!local.isOverflow,
    isActive: local.isActive !== false,
  };
  const existing = await prisma.seat.findUnique({
    where: { spaceId_label: { spaceId, label: local.label } },
  });
  if (existing) {
    if (!dry) await prisma.seat.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  if (!dry) {
    await prisma.seat.create({ data: { id: local.id, ...data } });
  }
  return local.id;
}

async function replaceDecor(prisma, spaceId, walls, fixtures, dry) {
  if (dry) {
    log(`    walls=${walls.length} fixtures=${fixtures.length} (replace)`);
    return;
  }
  await prisma.spaceWall.deleteMany({ where: { spaceId } });
  for (const w of walls) {
    await prisma.spaceWall.create({
      data: {
        spaceId,
        label: w.label,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        rotation: w.rotation ?? 0,
      },
    });
  }
  if (!prisma.spaceFixture) return;
  await prisma.spaceFixture.deleteMany({ where: { spaceId } });
  for (const f of fixtures) {
    await prisma.spaceFixture.create({
      data: {
        spaceId,
        kind: f.kind,
        label: f.label,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        rotation: f.rotation ?? 0,
      },
    });
  }
}

function priceMatch(existing, local, spaceId) {
  const sameName = existing.name === local.name;
  const sameCat = (existing.category || null) === (local.category || null);
  const sameSpace = (existing.spaceId || null) === (spaceId || null);
  return sameName && sameCat && sameSpace;
}

async function upsertPrice(prisma, local, spaceId, existingPrices, dry) {
  const match = existingPrices.find((p) => priceMatch(p, local, spaceId));
  const data = {
    name: local.name,
    price: local.price,
    type: local.type,
    category: local.category,
    durationHours: local.durationHours,
    billingUnit: local.billingUnit,
    periodDays: local.periodDays,
    spaceId: spaceId || null,
    reserveSeat: !!local.reserveSeat,
    timePeriod: local.timePeriod ?? {},
  };
  if (match) {
    if (!dry) {
      const updated = await prisma.price.update({
        where: { id: match.id },
        data,
      });
      Object.assign(match, updated);
    }
    log(`  price "${local.name}" → keep ${match.id} (${local.price} DT)`);
    return match.id;
  }
  if (!dry) {
    const created = await prisma.price.create({ data: { id: local.id, ...data } });
    existingPrices.push(created);
  } else {
    existingPrices.push({ ...data, id: local.id });
  }
  log(`  price created "${local.name}" (${local.price} DT)`);
  return local.id;
}

async function importSnapshot(prisma, snapshot) {
  const orgMap = new Map();
  const facMap = new Map();
  const spaceMap = new Map();
  const tableMap = new Map();

  log(dryRun ? "DRY RUN — no writes" : "Importing tarifs + seat map…");

  for (const org of snapshot.organizations || []) {
    orgMap.set(org.id, await upsertOrg(prisma, org, dryRun));
  }

  for (const fac of snapshot.facilities || []) {
    const orgId = fac.organizationId
      ? orgMap.get(fac.organizationId) || fac.organizationId
      : null;
    if (!orgId) {
      log(`  skip facility "${fac.name}" (no organization)`);
      continue;
    }
    const sameOrgCount = (snapshot.facilities || []).filter(
      (f) => f.organizationId === fac.organizationId
    ).length;
    facMap.set(
      fac.id,
      await upsertFacility(prisma, fac, orgId, dryRun, sameOrgCount <= 1)
    );
  }

  for (const space of snapshot.spaces || []) {
    const facilityId = facMap.get(space.facilityId);
    if (!facilityId) {
      log(`  skip space "${space.name}" (facility not mapped)`);
      continue;
    }
    spaceMap.set(
      space.id,
      await upsertSpace(prisma, space, facilityId, dryRun)
    );
  }

  for (const table of snapshot.tables || []) {
    const spaceId = spaceMap.get(table.spaceId);
    if (!spaceId) continue;
    tableMap.set(
      table.id,
      await upsertTable(prisma, table, spaceId, dryRun)
    );
  }

  for (const seat of snapshot.seats || []) {
    const spaceId = spaceMap.get(seat.spaceId);
    if (!spaceId) continue;
    const tableId = seat.tableId ? tableMap.get(seat.tableId) || null : null;
    await upsertSeat(prisma, seat, spaceId, tableId, dryRun);
  }

  const wallsBySpace = new Map();
  for (const w of snapshot.walls || []) {
    const sid = spaceMap.get(w.spaceId);
    if (!sid) continue;
    if (!wallsBySpace.has(sid)) wallsBySpace.set(sid, []);
    wallsBySpace.get(sid).push(w);
  }
  const fixturesBySpace = new Map();
  for (const f of snapshot.fixtures || []) {
    const sid = spaceMap.get(f.spaceId);
    if (!sid) continue;
    if (!fixturesBySpace.has(sid)) fixturesBySpace.set(sid, []);
    fixturesBySpace.get(sid).push(f);
  }
  for (const spaceId of new Set([...wallsBySpace.keys(), ...fixturesBySpace.keys()])) {
    await replaceDecor(
      prisma,
      spaceId,
      wallsBySpace.get(spaceId) || [],
      fixturesBySpace.get(spaceId) || [],
      dryRun
    );
  }

  const existingPrices = await prisma.price.findMany();
  for (const price of snapshot.prices || []) {
    const spaceId = price.spaceId ? spaceMap.get(price.spaceId) || null : null;
    await upsertPrice(prisma, price, spaceId, existingPrices, dryRun);
  }

  await seedAdmin(prisma, dryRun);
  log(dryRun ? "Dry run finished." : "Import finished.");
}

async function seedAdmin(prisma, dry) {
  const email = BOOTSTRAP_ADMIN.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (dry) {
    log(
      existing
        ? `  admin ${email} already exists (would reset password + ADMIN)`
        : `  admin ${email} would be created`
    );
    return;
  }
  const password = await bcrypt.hash(BOOTSTRAP_ADMIN.password, 10);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password,
        fullname: BOOTSTRAP_ADMIN.fullname,
        role: BOOTSTRAP_ADMIN.role,
        isActive: true,
      },
    });
    log(`  admin ${email} updated (ADMIN, password reset)`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      password,
      fullname: BOOTSTRAP_ADMIN.fullname,
      role: BOOTSTRAP_ADMIN.role,
      isActive: true,
    },
  });
  log(`  admin ${email} created`);
}

async function main() {
  if (!cmd || !["dump", "import", "seed-admin"].includes(cmd)) {
    console.error(
      "Usage: node scripts/tarif-seatmap.cjs dump|import|seed-admin [--dry-run] [file.json]"
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Set it in backend/.env");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    if (cmd === "dump") {
      await dump(prisma);
    } else if (cmd === "seed-admin") {
      await seedAdmin(prisma, dryRun);
    } else {
      if (!fs.existsSync(snapshotFile)) {
        console.error(`Snapshot not found: ${snapshotFile}`);
        process.exit(1);
      }
      const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
      await importSnapshot(prisma, snapshot);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
