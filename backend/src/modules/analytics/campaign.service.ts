import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { PushService } from '../push/push.service';
import { orderUnitPrice } from '../product/order-price';
import { parseLocalDay } from '../../../common/parse-local-day';
import {
  OUTREACH_OUTCOMES,
  OutreachService,
  whatsappNumber,
  type OutreachOutcome,
  type OutreachReason,
} from './outreach.service';
import { PerformanceService } from './performance.service';
import { round1 } from './traffic';

export const CAMPAIGN_SEGMENTS = [
  'ABO_EXPIRING',
  'ABO_ENDED',
  'INACTIVE',
  'TOP_UP',
  'CONVERT',
  'UNPAID',
  'RECENT_30',
  'ALL',
  'GROUP',
  /** People picked one by one */
  'MANUAL',
] as const;
export type CampaignSegment = (typeof CAMPAIGN_SEGMENTS)[number];
export const CAMPAIGN_GOALS = ['VISIT', 'SUBSCRIPTION', 'ANY'] as const;
const CAMPAIGN_CHANNELS = ['WHATSAPP', 'PUSH', 'CALL', 'SKIP'] as const;
/** Days after the message during which a visit / purchase counts as a result. */
const RESULT_WINDOW_DAYS = 14;
const AUTO_LISTS: OutreachReason[] = ['ABO_EXPIRING', 'ABO_ENDED', 'INACTIVE', 'TOP_UP', 'CONVERT', 'UNPAID'];
/** Most people a campaign can hold. */
const MAX_TARGETS = 1000;

type CampaignBody = {
  title?: string;
  message?: string;
  segment?: string;
  memberGroupId?: string | null;
  /** Picked by hand (ticked / unticked from a list): used instead of the segment's members */
  memberIds?: string[];
  goal?: string;
  sourceReportId?: string | null;
  recommendationTitle?: string | null;
  /** Also track it as a before/after initiative */
  trackAsInitiative?: boolean;
  category?: string;
};

/** "Bonjour {prenom}," → "Bonjour Sarra," (or "Bonjour," without a first name). */
export function personalize(template: string, firstName?: string | null) {
  const name = firstName?.trim() || '';
  return template
    .replace(/\{\s*pr[ée]nom\s*\}/gi, name)
    .replace(/ +([,.])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outreach: OutreachService,
    private readonly performance: PerformanceService,
    private readonly push: PushService,
  ) {}

  private async facilityId(facilityId?: string) {
    return (await this.performance.settings(facilityId)).facilityId;
  }

  /** Member ids of a segment right now. */
  async segmentMembers(segment: CampaignSegment, facilityId: string, groupId?: string | null) {
    if (segment === 'MANUAL') return [];
    if ((AUTO_LISTS as string[]).includes(segment)) {
      const list = await this.outreach.list(facilityId);
      return [...list.todo, ...list.contacted]
        .filter((i) => i.reason === segment)
        .map((i) => i.memberId);
    }
    if (segment === 'RECENT_30') {
      const rows = await this.prisma.journal.findMany({
        where: {
          registredTime: { gte: subDays(startOfDay(new Date()), 29) },
          isReservation: false,
          memberID: { not: null },
        },
        select: { memberID: true },
        distinct: ['memberID'],
      });
      return rows.map((r) => r.memberID!);
    }
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { organizationId: true },
    });
    const rows = await this.prisma.member.findMany({
      where: {
        deletedAt: null,
        ...(facility?.organizationId ? { organizationId: facility.organizationId } : {}),
        ...(segment === 'GROUP' ? { groupId: groupId || '__none__' } : { phone: { not: null } }),
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async organizationId(facilityId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { organizationId: true },
    });
    return facility?.organizationId ?? null;
  }

  /** Keep only existing members of this organisation (no duplicates). */
  private async validMembers(facilityId: string, ids: unknown) {
    const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((i): i is string => typeof i === 'string'))];
    if (!wanted.length) return [];
    const org = await this.organizationId(facilityId);
    const rows = await this.prisma.member.findMany({
      where: { id: { in: wanted }, deletedAt: null, ...(org ? { organizationId: org } : {}) },
      select: { id: true },
    });
    const ok = new Set(rows.map((r) => r.id));
    return wanted.filter((i) => ok.has(i));
  }

  /** People of a list, to tick / untick one by one (new campaign, "Ajouter"). */
  async candidates(facilityId?: string, segment?: string, groupId?: string | null) {
    const id = await this.facilityId(facilityId);
    const seg = (CAMPAIGN_SEGMENTS.includes(segment as CampaignSegment) ? segment : 'ALL') as CampaignSegment;
    const ids = [...new Set(await this.segmentMembers(seg === 'MANUAL' ? 'ALL' : seg, id, groupId))];
    if (!ids.length) return [];
    const [people, visits] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.journal.groupBy({
        by: ['memberID'],
        where: { memberID: { in: ids }, isReservation: false },
        _max: { registredTime: true },
      }),
    ]);
    const last = new Map(visits.map((v) => [v.memberID, v._max.registredTime]));
    return people
      .map((p) => ({
        memberId: p.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client',
        phone: p.phone,
        lastVisit: last.get(p.id)?.toISOString() ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async segmentCounts(facilityId?: string, groupId?: string | null) {
    const id = await this.facilityId(facilityId);
    const list = await this.outreach.list(id);
    const counts: Record<string, number> = {};
    for (const i of [...list.todo, ...list.contacted]) counts[i.reason] = (counts[i.reason] ?? 0) + 1;
    const [recent, all, group] = await Promise.all([
      this.segmentMembers('RECENT_30', id),
      this.segmentMembers('ALL', id),
      groupId ? this.segmentMembers('GROUP', id, groupId) : Promise.resolve([]),
    ]);
    return {
      ...Object.fromEntries(AUTO_LISTS.map((r) => [r, counts[r] ?? 0])),
      RECENT_30: recent.length,
      ALL: all.length,
      GROUP: group.length,
    } as Record<CampaignSegment, number>;
  }

  async create(facilityId: string | undefined, body: CampaignBody) {
    const id = await this.facilityId(facilityId);
    const title = (body.title || '').trim();
    const message = (body.message || '').trim();
    if (!title || title.length > 200) throw new BadRequestException('Titre requis (200 max)');
    if (!message || message.length > 2000) throw new BadRequestException('Message requis (2000 max)');
    const picked = Array.isArray(body.memberIds);
    const segment = (
      CAMPAIGN_SEGMENTS.includes(body.segment as CampaignSegment) ? body.segment : picked ? 'MANUAL' : null
    ) as CampaignSegment | null;
    if (!segment) throw new BadRequestException('Liste de clients invalide');
    if (!picked && segment === 'MANUAL') throw new BadRequestException('Choisissez les personnes');
    if (!picked && segment === 'GROUP' && !body.memberGroupId) throw new BadRequestException('Choisissez le groupe');
    const goal = CAMPAIGN_GOALS.includes(body.goal as (typeof CAMPAIGN_GOALS)[number])
      ? body.goal!
      : 'ANY';
    const memberIds = picked
      ? await this.validMembers(id, body.memberIds)
      : [...new Set(await this.segmentMembers(segment, id, body.memberGroupId))];
    if (!memberIds.length) {
      throw new BadRequestException(picked ? 'Cochez au moins une personne' : 'Personne dans cette liste pour le moment');
    }
    if (memberIds.length > MAX_TARGETS) throw new BadRequestException(`${MAX_TARGETS} personnes au plus`);

    let initiativeId: string | null = null;
    if (body.trackAsInitiative) {
      const initiative = await this.prisma.businessInitiative.create({
        data: {
          facilityId: id,
          title,
          description: `Relance de ${memberIds.length} clients : ${message.slice(0, 500)}`,
          category: body.category || 'RETENTION',
          startDate: startOfDay(new Date()),
          sourceReportId: body.sourceReportId || null,
          recommendationTitle: body.recommendationTitle?.slice(0, 300) || null,
          metric: ['ABO_EXPIRING', 'ABO_ENDED', 'TOP_UP', 'CONVERT'].includes(segment)
            ? 'revenueSubscriptions'
            : 'visitsPerDay',
          // Measured on the contacted clients, compared to the others
          targetKind: 'LIST',
          targetSegment: segment,
          targetMemberIds: memberIds,
        },
      });
      initiativeId = initiative.id;
    }
    const campaign = await this.prisma.outreachCampaign.create({
      data: {
        facilityId: id,
        title,
        message,
        segment,
        memberGroupId: segment === 'GROUP' ? body.memberGroupId || null : null,
        memberIds,
        goal,
        sourceReportId: body.sourceReportId || null,
        recommendationTitle: body.recommendationTitle?.slice(0, 300) || null,
        initiativeId,
      },
    });
    return (await this.withProgress([campaign]))[0];
  }

  async update(id: string, body: { title?: string; message?: string; status?: string }) {
    const data: { title?: string; message?: string; status?: string } = {};
    if (body.title !== undefined) data.title = body.title.trim().slice(0, 200) || undefined;
    if (body.message !== undefined) data.message = body.message.trim().slice(0, 2000) || undefined;
    if (body.status !== undefined) data.status = body.status === 'DONE' ? 'DONE' : 'ACTIVE';
    const row = await this.prisma.outreachCampaign.update({ where: { id }, data }).catch(() => {
      throw new NotFoundException('Campagne introuvable');
    });
    return (await this.withProgress([row]))[0];
  }

  async remove(id: string) {
    await this.prisma.outreachCampaign.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Campagne introuvable');
    });
    return { ok: true };
  }

  /** Add people to a campaign that already exists, or take some out. */
  async members(id: string, body: { add?: string[]; remove?: string[] }) {
    const c = await this.prisma.outreachCampaign.findUnique({
      where: { id },
      select: { facilityId: true, memberIds: true },
    });
    if (!c) throw new NotFoundException('Campagne introuvable');
    const add = await this.validMembers(c.facilityId, body.add);
    const remove = new Set(Array.isArray(body.remove) ? body.remove : []);
    const next = [...new Set([...c.memberIds.filter((m) => !remove.has(m)), ...add])];
    if (!next.length) throw new BadRequestException('Une campagne garde au moins une personne');
    if (next.length > MAX_TARGETS) throw new BadRequestException(`${MAX_TARGETS} personnes au plus`);
    await this.prisma.outreachCampaign.update({ where: { id }, data: { memberIds: next } });
    return { total: next.length, added: add.filter((m) => !c.memberIds.includes(m)).length };
  }

  /** What the member answered (same answers as Relances), a note, the day to call back. */
  async answer(
    id: string,
    body: { memberId?: string; outcome?: string | null; note?: string | null; followUpAt?: string | null },
  ) {
    const c = await this.prisma.outreachCampaign.findUnique({ where: { id }, select: { memberIds: true } });
    if (!c) throw new NotFoundException('Campagne introuvable');
    if (!body.memberId || !c.memberIds.includes(body.memberId)) {
      throw new BadRequestException('Client hors de cette campagne');
    }
    const outcome = (body.outcome ?? null) as OutreachOutcome | null;
    if (outcome !== null && !OUTREACH_OUTCOMES.includes(outcome)) throw new BadRequestException('Réponse invalide');
    const data = {
      outcome,
      note: body.note?.trim().slice(0, 500) || null,
      followUpAt: outcome && outcome !== 'NOT_INTERESTED' && body.followUpAt ? parseLocalDay(body.followUpAt.slice(0, 10)) : null,
    };
    const last = await this.prisma.memberOutreach.findFirst({
      where: { campaignId: id, memberId: body.memberId, channel: { not: 'SKIP' } },
      orderBy: { createdAt: 'desc' },
    });
    if (last) return this.prisma.memberOutreach.update({ where: { id: last.id }, data });
    // Answered without a logged contact (talked at the desk): record it as a call
    return this.prisma.memberOutreach.create({
      data: { memberId: body.memberId, reason: 'CAMPAIGN', channel: 'CALL', campaignId: id, ...data },
    });
  }

  async list(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const rows = await this.prisma.outreachCampaign.findMany({
      where: { facilityId: id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return this.withProgress(rows);
  }

  /** Per member: first contact for the campaign and what followed within the window. */
  private async memberResults(campaign: { id: string; memberIds: string[]; goal: string; segment?: string; createdAt?: Date }) {
    const contacts = await this.prisma.memberOutreach.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'asc' },
    });
    const first = new Map<string, Date>();
    const lastChannel = new Map<string, string>();
    /** Latest real contact: its answer is the member's current answer */
    const lastContact = new Map<string, (typeof contacts)[number]>();
    for (const c of contacts) {
      lastChannel.set(c.memberId, c.channel);
      if (c.channel !== 'SKIP') {
        lastContact.set(c.memberId, c);
        if (!first.has(c.memberId)) first.set(c.memberId, c.createdAt);
      }
    }
    const ids = [...first.keys()];
    const out = new Map<
      string,
      {
        contactedAt: Date | null;
        lastContactAt: Date | null;
        channel: string | null;
        outcome: string | null;
        note: string | null;
        followUpAt: Date | null;
        won: boolean;
        revenue: number;
        withoutContact?: boolean;
      }
    >();
    for (const m of campaign.memberIds) {
      const lc = lastContact.get(m);
      out.set(m, {
        contactedAt: first.get(m) ?? null,
        lastContactAt: lc?.createdAt ?? null,
        channel: lastChannel.get(m) ?? null,
        outcome: lc?.outcome ?? null,
        note: lc?.note ?? null,
        followUpAt: lc?.followUpAt ?? null,
        won: false,
        revenue: 0,
      });
    }
    // Abonnement lists: a renewal counts even when the contact was not logged in
    // the app (talked at the desk, renewed with another offer…)
    if (campaign.createdAt && (campaign.segment === 'ABO_EXPIRING' || campaign.segment === 'ABO_ENDED')) {
      const silent = campaign.memberIds.filter((m) => !first.has(m) && lastChannel.get(m) !== 'SKIP');
      if (silent.length) {
        const from = campaign.createdAt;
        const to = addDays(from, 30);
        const abos = await this.prisma.abonnement.findMany({
          where: { memberID: { in: silent }, isReservation: false, hiddenAt: null, createdAt: { gt: from, lte: to } },
          select: { memberID: true, amountDue: true, payedAmount: true },
        });
        for (const a of abos) {
          const r = out.get(a.memberID)!;
          r.won = true;
          r.withoutContact = true;
          r.revenue = round1(r.revenue + (a.amountDue ?? a.payedAmount ?? 0));
        }
      }
    }
    if (!ids.length) return out;
    const since = new Date(Math.min(...[...first.values()].map((d) => d.getTime())));
    const [visits, abos, orders] = await Promise.all([
      this.prisma.journal.findMany({
        where: { memberID: { in: ids }, registredTime: { gt: since }, isReservation: false },
        select: { memberID: true, registredTime: true, payedAmount: true, isPayed: true },
      }),
      this.prisma.abonnement.findMany({
        where: { memberID: { in: ids }, createdAt: { gt: since }, isReservation: false },
        select: { memberID: true, createdAt: true, amountDue: true, payedAmount: true },
      }),
      this.prisma.dailyProduct.findMany({
        where: {
          memberId: { in: ids },
          createdAt: { gt: since },
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
        select: { memberId: true, createdAt: true, quantite: true, unitPrice: true, product: { select: { sellingPrice: true } } },
      }),
    ]);
    for (const [memberId, at] of first) {
      const end = addDays(at, RESULT_WINDOW_DAYS);
      const inWin = (d: Date | null | undefined) => !!d && d > at && d <= end;
      const v = visits.filter((x) => x.memberID === memberId && inWin(x.registredTime));
      const a = abos.filter((x) => x.memberID === memberId && inWin(x.createdAt));
      const o = orders.filter((x) => x.memberId === memberId && inWin(x.createdAt));
      const won =
        campaign.goal === 'VISIT'
          ? v.length > 0
          : campaign.goal === 'SUBSCRIPTION'
            ? a.length > 0
            : v.length + a.length + o.length > 0;
      const revenue =
        v.reduce((s, x) => s + (x.isPayed ? x.payedAmount || 0 : 0), 0) +
        a.reduce((s, x) => s + (x.amountDue ?? x.payedAmount ?? 0), 0) +
        o.reduce((s, x) => s + orderUnitPrice(x) * x.quantite, 0);
      const r = out.get(memberId)!;
      r.won = won;
      r.revenue = won ? round1(revenue) : 0;
    }
    return out;
  }

  private async withProgress<T extends { id: string; memberIds: string[]; goal: string }>(rows: T[]) {
    return Promise.all(
      rows.map(async (c) => {
        const results = await this.memberResults(c);
        const values = [...results.values()];
        return {
          ...c,
          progress: {
            total: c.memberIds.length,
            contacted: values.filter((v) => v.contactedAt).length,
            skipped: values.filter((v) => !v.won && !v.contactedAt && v.channel === 'SKIP').length,
            /** Not contacted yet (nor skipped, nor already won) */
            todo: values.filter((v) => !v.won && !v.contactedAt && v.channel !== 'SKIP').length,
            /** Contacted, waiting for an answer */
            waiting: values.filter((v) => !v.won && v.contactedAt && !v.outcome).length,
            noAnswer: values.filter((v) => !v.won && v.outcome === 'NO_ANSWER').length,
            answered: values.filter((v) => !v.won && v.outcome && v.outcome !== 'NO_ANSWER').length,
            won: values.filter((v) => v.won).length,
            revenue: round1(values.reduce((s, v) => s + v.revenue, 0)),
          },
        };
      }),
    );
  }

  /** Campaign with each client: personalised message, contact status and result. */
  async detail(id: string) {
    const c = await this.prisma.outreachCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campagne introuvable');
    const [people, pushRows, results] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: c.memberIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.pushSubscription.groupBy({
        by: ['memberId'],
        where: { memberId: { in: c.memberIds } },
        _count: true,
      }),
      this.memberResults(c),
    ]);
    const withPush = new Set(pushRows.map((p) => p.memberId));
    const pushEnabled = this.push.isEnabled();
    const [withProgress] = await this.withProgress([c]);
    return {
      ...withProgress,
      pushEnabled,
      targets: people
        .map((p) => {
          const r = results.get(p.id);
          return {
            memberId: p.id,
            name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Client',
            phone: p.phone,
            whatsapp: whatsappNumber(p.phone),
            hasPush: pushEnabled && withPush.has(p.id),
            message: personalize(c.message, p.firstName),
            contactedAt: r?.contactedAt ?? null,
            lastContactAt: r?.lastContactAt ?? null,
            channel: r?.channel ?? null,
            outcome: r?.outcome ?? null,
            note: r?.note ?? null,
            followUpAt: r?.followUpAt ?? null,
            won: !!r?.won,
            /** Renewed although no contact was logged in the app */
            withoutContact: !!r?.withoutContact,
            revenue: r?.revenue ?? 0,
          };
        })
        .sort((a, b) => Number(!!a.contactedAt) - Number(!!b.contactedAt) || a.name.localeCompare(b.name, 'fr')),
    };
  }

  async log(id: string, body: { memberId?: string; channel?: string; message?: string }) {
    const c = await this.prisma.outreachCampaign.findUnique({ where: { id }, select: { memberIds: true, message: true } });
    if (!c) throw new NotFoundException('Campagne introuvable');
    if (!body.memberId || !c.memberIds.includes(body.memberId)) {
      throw new BadRequestException('Client hors de cette campagne');
    }
    if (!CAMPAIGN_CHANNELS.includes(body.channel as (typeof CAMPAIGN_CHANNELS)[number])) {
      throw new BadRequestException('Canal invalide');
    }
    if (body.channel === 'PUSH') {
      if (!this.push.isEnabled()) throw new BadRequestException('Notifications push non configurées');
      const member = await this.prisma.member.findUnique({ where: { id: body.memberId }, select: { firstName: true } });
      await this.push.sendToMember(body.memberId, {
        title: 'Une offre pour vous',
        body: (body.message || personalize(c.message, member?.firstName)).trim(),
        tag: `campaign-${id}`,
        url: '/m',
      });
    }
    return this.prisma.memberOutreach.create({
      data: {
        memberId: body.memberId,
        reason: 'CAMPAIGN',
        channel: body.channel!,
        message: body.message?.slice(0, 2000) || null,
        campaignId: id,
      },
    });
  }
}
