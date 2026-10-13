import { createHash } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addDays, endOfDay, getDay, min as minDate, startOfDay } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { localDayKey, parseLocalDay } from '../../../common/parse-local-day';
import { PerformanceService } from '../analytics/performance.service';
import { round1 } from '../analytics/traffic';
import { nearbyPlaces, parseLocation, weatherDays, weatherLabel } from './external-data';
import { presetYears, tunisiaCalendar } from './tunisia-calendar';

export const FACT_KINDS = ['HOLIDAY', 'PERIOD', 'LOCAL_EVENT', 'NEIGHBOR', 'AUDIENCE'] as const;
type FactKind = (typeof FACT_KINDS)[number];
const DATED: FactKind[] = ['HOLIDAY', 'PERIOD', 'LOCAL_EVENT'];

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** Lunar dates closer than this are pushed to the checklist for confirmation. */
const CONFIRM_AHEAD_DAYS = 120;
const UPCOMING_DAYS = 45;
const RAIN_MM = 1;
const HOT_C = 32;

type FactBody = {
  kind?: string;
  title?: string;
  detail?: string | null;
  tag?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  distanceM?: number | null;
  memberGroupId?: string | null;
  confirmed?: boolean;
  externalId?: string | null;
  source?: string;
};

export type MissingItem = {
  key: string;
  section: 'location' | 'calendar' | 'neighbors' | 'audiences' | 'charges' | 'context' | 'questions';
  title: string;
  detail: string;
  action?:
    | { type: 'seed-holidays' }
    | { type: 'confirm'; factId: string; startDate: string; endDate: string | null }
    | { type: 'link'; href: string };
};

const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const pctChange = (cur: number | null, base: number | null) =>
  cur != null && base ? Math.round(((cur - base) / base) * 100) : null;

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
  ) {}

  async resolve(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  // ---------- location ----------

  async location(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const f = await this.prisma.facility.findUniqueOrThrow({
      where: { id },
      select: { latitude: true, longitude: true, adresse: true },
    });
    return { facilityId: id, latitude: f.latitude, longitude: f.longitude, address: f.adresse };
  }

  async setLocation(
    facilityId: string | undefined,
    body: { input?: string; latitude?: number | null; longitude?: number | null },
  ) {
    const id = await this.resolve(facilityId);
    let coords: { lat: number; lon: number } | null = null;
    if (body.input?.trim()) {
      coords = await parseLocation(body.input).catch(() => null);
      if (!coords) {
        throw new BadRequestException(
          'Position introuvable : collez un lien Google Maps ou « latitude, longitude » (ex. 36.72, 10.21).',
        );
      }
    } else if (body.latitude != null && body.longitude != null) {
      coords = { lat: Number(body.latitude), lon: Number(body.longitude) };
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
        throw new BadRequestException('Coordonnées invalides');
      }
    }
    await this.prisma.facility.update({
      where: { id },
      data: { latitude: coords?.lat ?? null, longitude: coords?.lon ?? null },
    });
    return this.location(id);
  }

  async nearby(facilityId?: string, radius?: number) {
    const id = await this.resolve(facilityId);
    const loc = await this.location(id);
    if (loc.latitude == null || loc.longitude == null) {
      throw new BadRequestException("Placez d'abord votre espace sur la carte.");
    }
    const r = Math.min(2000, Math.max(200, Math.round(Number(radius) || 700)));
    let places;
    try {
      places = await nearbyPlaces(loc.latitude, loc.longitude, r);
    } catch (err) {
      this.logger.warn(`OpenStreetMap lookup failed: ${(err as Error).message}`);
      throw new BadRequestException('OpenStreetMap ne répond pas, réessayez dans une minute.');
    }
    const known = await this.prisma.advisorFact.findMany({
      where: { facilityId: id, externalId: { in: places.map((p) => p.externalId) } },
      select: { externalId: true },
    });
    const added = new Set(known.map((k) => k.externalId));
    return places.map((p) => ({ ...p, added: added.has(p.externalId) }));
  }

  // ---------- facts ----------

  async facts(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const rows = await this.prisma.advisorFact.findMany({
      where: { facilityId: id },
      orderBy: [{ kind: 'asc' }, { startDate: 'asc' }, { distanceM: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  private serialize(r: Prisma.AdvisorFactGetPayload<object>) {
    return {
      ...r,
      startDate: r.startDate ? localDayKey(r.startDate) : null,
      endDate: r.endDate ? localDayKey(r.endDate) : null,
    };
  }

  private factData(body: FactBody, creating: boolean) {
    const data: Prisma.AdvisorFactUncheckedUpdateInput = {};
    if (body.kind !== undefined || creating) {
      if (!(FACT_KINDS as readonly string[]).includes(body.kind || '')) {
        throw new BadRequestException('Type invalide');
      }
      data.kind = body.kind;
    }
    if (body.title !== undefined || creating) {
      const title = (body.title || '').trim();
      if (!title || title.length > 200) throw new BadRequestException('Nom requis (200 max)');
      data.title = title;
    }
    if (body.detail !== undefined) {
      const detail = body.detail?.trim() || null;
      if (detail && detail.length > 2000) throw new BadRequestException('Détail trop long');
      data.detail = detail;
    }
    if (body.tag !== undefined) data.tag = body.tag?.trim() || null;
    for (const k of ['startDate', 'endDate'] as const) {
      if (body[k] === undefined) continue;
      if (!body[k]) {
        data[k] = null;
        continue;
      }
      const d = parseLocalDay(body[k]);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Date invalide');
      data[k] = d;
    }
    if (body.distanceM !== undefined) {
      data.distanceM = body.distanceM == null ? null : Math.max(0, Math.round(body.distanceM));
    }
    if (body.memberGroupId !== undefined) data.memberGroupId = body.memberGroupId || null;
    if (body.confirmed !== undefined) data.confirmed = !!body.confirmed;
    if (body.externalId !== undefined) data.externalId = body.externalId || null;
    if (body.source !== undefined) data.source = body.source === 'OSM' ? 'OSM' : 'MANUAL';
    return data;
  }

  async createFact(facilityId: string | undefined, body: FactBody) {
    const id = await this.resolve(facilityId);
    const data = this.factData(body, true);
    if (DATED.includes(body.kind as FactKind) && !data.startDate) {
      throw new BadRequestException('Date de début requise');
    }
    try {
      const row = await this.prisma.advisorFact.create({
        data: { ...(data as Prisma.AdvisorFactUncheckedCreateInput), facilityId: id },
      });
      return this.serialize(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Déjà ajouté');
      }
      throw err;
    }
  }

  async updateFact(id: string, body: FactBody) {
    const { kind: _kind, ...rest } = body;
    const row = await this.prisma.advisorFact
      .update({ where: { id }, data: { ...this.factData(rest, false) } })
      .catch(() => {
        throw new NotFoundException('Élément introuvable');
      });
    return this.serialize(row);
  }

  async deleteFact(id: string) {
    await this.prisma.advisorFact.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Élément introuvable');
    });
    return { ok: true };
  }

  /** Adds Tunisian holidays and Ramadan for every preset year (idempotent). */
  async seedHolidays(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const presets = presetYears().flatMap((y) => tunisiaCalendar(y));
    const res = await this.prisma.advisorFact.createMany({
      data: presets.map((p) => ({
        facilityId: id,
        kind: p.kind,
        tag: p.tag || null,
        title: p.title,
        startDate: parseLocalDay(p.start),
        endDate: p.end ? parseLocalDay(p.end) : null,
        source: 'PRESET',
        confirmed: p.confirmed,
        externalId: p.key,
      })),
      skipDuplicates: true,
    });
    return { added: res.count };
  }

  // ---------- questions ----------

  private questionKey(q: string) {
    const norm = q.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim();
    return createHash('sha1').update(norm).digest('hex').slice(0, 20);
  }

  /** Keeps the questions of a finished report so the owner can answer them in the app. */
  async storeQuestions(facilityId: string, reportId: string, questions: string[]) {
    for (const q of questions.map((x) => x.trim()).filter(Boolean)) {
      await this.prisma.advisorQuestion.upsert({
        where: { facilityId_key: { facilityId, key: this.questionKey(q) } },
        create: { facilityId, key: this.questionKey(q), question: q, reportId },
        update: {},
      });
    }
  }

  async questions(facilityId?: string) {
    const id = await this.resolve(facilityId);
    return this.prisma.advisorQuestion.findMany({
      where: { facilityId: id },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async answerQuestion(id: string, body: { answer?: string | null; status?: string }) {
    const answer = body.answer?.trim() || null;
    if (answer && answer.length > 2000) throw new BadRequestException('Réponse trop longue');
    const status =
      body.status === 'DISMISSED' ? 'DISMISSED' : answer ? 'ANSWERED' : 'OPEN';
    return this.prisma.advisorQuestion
      .update({ where: { id }, data: { answer, status } })
      .catch(() => {
        throw new NotFoundException('Question introuvable');
      });
  }

  // ---------- missing information ----------

  async missing(facilityId?: string) {
    const id = await this.resolve(facilityId);
    const now = new Date();
    const today = startOfDay(now);
    const [facility, facts, monthlyCharges, openQuestions] = await Promise.all([
      this.prisma.facility.findUniqueOrThrow({
        where: { id },
        select: { latitude: true, businessContext: true },
      }),
      this.prisma.advisorFact.findMany({ where: { facilityId: id } }),
      this.prisma.expense.count({ where: { type: 'MENSUEL' } }),
      this.prisma.advisorQuestion.count({ where: { facilityId: id, status: 'OPEN' } }),
    ]);
    const items: MissingItem[] = [];
    const checks: Array<[boolean, MissingItem]> = [];
    const of = (k: FactKind) => facts.filter((f) => f.kind === k);
    const inNextYear = (f: { startDate: Date | null }) =>
      !!f.startDate && f.startDate >= today && f.startDate <= addDays(today, 365);

    checks.push([
      facility.latitude != null,
      {
        key: 'location',
        section: 'location',
        title: 'Placez votre espace sur la carte',
        detail: 'Permet d’ajouter la météo et de trouver vos voisins (restaurants, foyers, facultés).',
      },
    ]);
    checks.push([
      of('HOLIDAY').some(inNextYear),
      {
        key: 'holidays',
        section: 'calendar',
        title: 'Ajoutez les jours fériés tunisiens',
        detail: 'Pour que l’IA ne confonde pas un jour férié avec une baisse d’activité.',
        action: { type: 'seed-holidays' },
      },
    ]);
    checks.push([
      of('PERIOD').some((f) => f.tag !== 'ramadan' && inNextYear(f)),
      {
        key: 'academic',
        section: 'calendar',
        title: 'Dates d’examens et de vacances',
        detail:
          'Révisions, examens et vacances changent beaucoup la fréquentation des étudiants. Ajoutez les prochaines dates.',
      },
    ]);
    checks.push([
      of('NEIGHBOR').length > 0,
      {
        key: 'neighbors',
        section: 'neighbors',
        title: 'Décrivez votre voisinage',
        detail: 'Restaurants, magasins, foyers, facultés autour de vous : idées de partenariats.',
      },
    ]);
    checks.push([
      of('AUDIENCE').length > 0,
      {
        key: 'audiences',
        section: 'audiences',
        title: 'Vos types de clients',
        detail:
          'Ex. : étudiantes du foyer voisin, budget serré. L’IA adaptera prix et offres à chaque public.',
      },
    ]);
    checks.push([
      monthlyCharges > 0,
      {
        key: 'charges',
        section: 'charges',
        title: 'Ajoutez vos charges mensuelles',
        detail: 'Loyer, internet, électricité : sans elles, l’IA ne peut pas juger la rentabilité.',
        action: { type: 'link', href: '/expenses' },
      },
    ]);
    checks.push([
      !!facility.businessContext?.trim(),
      {
        key: 'context',
        section: 'context',
        title: 'Écrivez votre contexte',
        detail: 'Quartier, concurrents et leurs prix, objectifs, ce que vous avez déjà essayé.',
      },
    ]);
    for (const [ok, item] of checks) if (!ok) items.push(item);

    for (const f of facts) {
      if (
        !f.confirmed &&
        f.startDate &&
        f.startDate >= addDays(today, -1) &&
        f.startDate <= addDays(today, CONFIRM_AHEAD_DAYS)
      ) {
        items.push({
          key: `confirm:${f.id}`,
          section: 'calendar',
          title: `Confirmez la date : ${f.title}`,
          detail: `Date estimée au ${localDayKey(f.startDate)}${
            f.endDate ? ` → ${localDayKey(f.endDate)}` : ''
          }. Corrigez-la si l’annonce officielle diffère.`,
          action: {
            type: 'confirm',
            factId: f.id,
            startDate: localDayKey(f.startDate),
            endDate: f.endDate ? localDayKey(f.endDate) : null,
          },
        });
      }
    }
    if (openQuestions) {
      items.push({
        key: 'questions',
        section: 'questions',
        title: `${openQuestions} question${openQuestions > 1 ? 's' : ''} de l’IA sans réponse`,
        detail: 'Vos réponses seront envoyées avec la prochaine analyse.',
      });
    }
    return {
      items,
      completed: checks.filter(([ok]) => ok).length,
      total: checks.length,
    };
  }

  // ---------- snapshot section ----------

  /** Owner context + public data added to the snapshot sent to Claude. */
  async snapshotContext(facilityId: string, window: { prevStart: Date; start: Date; end: Date }) {
    const now = new Date();
    const today = startOfDay(now);
    const last = endOfDay(minDate([window.end, now]));
    const [facility, facts, answers, open, missing, journals] = await Promise.all([
      this.prisma.facility.findUniqueOrThrow({
        where: { id: facilityId },
        select: { latitude: true, longitude: true },
      }),
      this.prisma.advisorFact.findMany({ where: { facilityId } }),
      this.prisma.advisorQuestion.findMany({
        where: { facilityId, status: 'ANSWERED' },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: { question: true, answer: true },
      }),
      this.prisma.advisorQuestion.findMany({
        where: { facilityId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { question: true },
      }),
      this.missing(facilityId),
      this.prisma.journal.findMany({
        where: { registredTime: { gte: window.prevStart, lte: last }, isReservation: false },
        select: { registredTime: true },
      }),
    ]);

    const visitsByDay = new Map<string, number>();
    for (let d = startOfDay(window.prevStart); d <= last; d = addDays(d, 1)) {
      visitsByDay.set(localDayKey(d), 0);
    }
    for (const j of journals) {
      const k = localDayKey(j.registredTime);
      visitsByDay.set(k, (visitsByDay.get(k) || 0) + 1);
    }

    const dated = facts.filter((f) => DATED.includes(f.kind as FactKind) && f.startDate);
    const daysOf = (f: (typeof dated)[number]) => {
      const out: string[] = [];
      const endAt = f.endDate && f.endDate > f.startDate! ? f.endDate : f.startDate!;
      for (let d = startOfDay(f.startDate!); d <= endAt; d = addDays(d, 1)) out.push(localDayKey(d));
      return out;
    };
    const special = new Set(
      dated.filter((f) => f.kind !== 'LOCAL_EVENT').flatMap((f) => daysOf(f)),
    );
    const dayKeyWeekday = (k: string) => getDay(parseLocalDay(k));

    const calendarInWindow = dated
      .map((f) => {
        const days = daysOf(f).filter((k) => visitsByDay.has(k));
        if (!days.length) return null;
        const weekdays = new Set(days.map(dayKeyWeekday));
        const usual = [...visitsByDay.entries()]
          .filter(([k]) => !special.has(k) && weekdays.has(dayKeyWeekday(k)))
          .map(([, n]) => n);
        const during = avg(days.map((k) => visitsByDay.get(k) || 0));
        const usualAvg = avg(usual);
        return {
          title: f.title,
          kind: f.kind,
          tag: f.tag,
          from: localDayKey(f.startDate!),
          to: f.endDate ? localDayKey(f.endDate) : null,
          confirmedDate: f.confirmed,
          daysInWindow: days.length,
          visitsPerDay: during,
          usualVisitsPerDaySameWeekdays: usualAvg,
          changePct: pctChange(during, usualAvg),
        };
      })
      .filter(Boolean);

    const upcoming = dated
      .filter(
        (f) =>
          (f.endDate || f.startDate!) >= today && f.startDate! <= addDays(today, UPCOMING_DAYS),
      )
      .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime())
      .map((f) => ({
        title: f.title,
        kind: f.kind,
        tag: f.tag,
        from: localDayKey(f.startDate!),
        to: f.endDate ? localDayKey(f.endDate) : null,
        weekday: WEEKDAYS[getDay(f.startDate!)],
        confirmedDate: f.confirmed,
        detail: f.detail,
      }));

    const weather =
      facility.latitude != null && facility.longitude != null
        ? await this.weather(facility.latitude, facility.longitude, window.start, last, visitsByDay)
        : null;

    const audiences = await Promise.all(
      facts
        .filter((f) => f.kind === 'AUDIENCE')
        .map(async (f) => ({
          title: f.title,
          detail: f.detail,
          measuredByMemberGroup: f.memberGroupId
            ? await this.groupStats(f.memberGroupId, window.start, last)
            : null,
        })),
    );

    return {
      calendar: {
        note: 'jours fériés, périodes (Ramadan, examens, vacances) et événements locaux saisis par le propriétaire ; visites comparées aux mêmes jours de semaine hors jours spéciaux',
        inAnalysedWindow: calendarInWindow,
        next45Days: upcoming,
      },
      weather,
      neighbors: facts
        .filter((f) => f.kind === 'NEIGHBOR')
        .sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))
        .slice(0, 40)
        .map((f) => ({ name: f.title, type: f.tag, distanceM: f.distanceM, notes: f.detail })),
      audiences,
      ownerAnswers: answers,
      openQuestions: open.map((q) => q.question),
      missingInfo: missing.items.filter((i) => i.section !== 'questions').map((i) => i.title),
    };
  }

  private async weather(
    lat: number,
    lon: number,
    start: Date,
    last: Date,
    visitsByDay: Map<string, number>,
  ) {
    let days;
    try {
      days = await weatherDays(lat, lon, localDayKey(start), localDayKey(last));
    } catch (err) {
      this.logger.warn(`Weather lookup failed: ${(err as Error).message}`);
      return { unavailable: true };
    }
    const todayKey = localDayKey(new Date());
    const past = days.filter(
      (d) => d.date >= localDayKey(start) && d.date <= localDayKey(last) && visitsByDay.has(d.date),
    );
    const group = (pred: (d: (typeof past)[number]) => boolean) => {
      const sel = past.filter(pred);
      return { days: sel.length, avgVisits: avg(sel.map((d) => visitsByDay.get(d.date) || 0)) };
    };
    return {
      source: 'Open-Meteo',
      analysedPeriod: {
        rainyDays: group((d) => (d.precipitationMm ?? 0) >= RAIN_MM),
        dryDays: group((d) => (d.precipitationMm ?? 0) < RAIN_MM),
        hotDays: group((d) => (d.tempMax ?? 0) >= HOT_C),
        otherDays: group((d) => (d.tempMax ?? 0) < HOT_C),
        definition: `pluie : ≥ ${RAIN_MM} mm ; chaud : max ≥ ${HOT_C} °C ; avgVisits = visites moyennes ces jours-là`,
      },
      next7Days: days
        .filter((d) => d.date > todayKey)
        .slice(0, 7)
        .map((d) => ({
          date: d.date,
          day: WEEKDAYS[getDay(parseLocalDay(d.date))],
          tempMax: d.tempMax,
          precipitationMm: d.precipitationMm,
          sky: weatherLabel(d.code, d.precipitationMm),
        })),
    };
  }

  private async groupStats(groupId: string, start: Date, end: Date) {
    const group = await this.prisma.memberGroup.findUnique({
      where: { id: groupId },
      select: { name: true, _count: { select: { members: true } } },
    });
    if (!group) return null;
    const visits = await this.prisma.journal.findMany({
      where: {
        registredTime: { gte: start, lte: end },
        isReservation: false,
        members: { groupId },
      },
      select: { memberID: true, isPayed: true, payedAmount: true },
    });
    return {
      group: group.name,
      members: group._count.members,
      visitsInPeriod: visits.length,
      activeMembersInPeriod: new Set(visits.map((v) => v.memberID)).size,
      paidInPeriod: round1(visits.reduce((a, v) => a + (v.isPayed ? v.payedAmount || 0 : 0), 0)),
    };
  }
}
