import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { addDays, startOfDay, subDays } from 'date-fns';
import { PrismaService } from 'database/prisma.service';
import { PushService } from '../push/push.service';
import { orderUnitPrice } from '../product/order-price';
import { OutreachService, whatsappNumber, type OutreachReason } from './outreach.service';
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
] as const;
export type CampaignSegment = (typeof CAMPAIGN_SEGMENTS)[number];
export const CAMPAIGN_GOALS = ['VISIT', 'SUBSCRIPTION', 'ANY'] as const;
const CAMPAIGN_CHANNELS = ['WHATSAPP', 'PUSH', 'CALL', 'SKIP'] as const;
/** Days after the message during which a visit / purchase counts as a result. */
const RESULT_WINDOW_DAYS = 14;
const AUTO_LISTS: OutreachReason[] = ['ABO_EXPIRING', 'ABO_ENDED', 'INACTIVE', 'TOP_UP', 'CONVERT', 'UNPAID'];

type CampaignBody = {
  title?: string;
  message?: string;
  segment?: string;
  memberGroupId?: string | null;
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
    if (!CAMPAIGN_SEGMENTS.includes(body.segment as CampaignSegment)) {
      throw new BadRequestException('Liste de clients invalide');
    }
    const segment = body.segment as CampaignSegment;
    if (segment === 'GROUP' && !body.memberGroupId) throw new BadRequestException('Choisissez le groupe');
    const goal = CAMPAIGN_GOALS.includes(body.goal as (typeof CAMPAIGN_GOALS)[number])
      ? body.goal!
      : 'ANY';
    const memberIds = [...new Set(await this.segmentMembers(segment, id, body.memberGroupId))];
    if (!memberIds.length) throw new BadRequestException('Personne dans cette liste pour le moment');

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
        memberGroupId: segment === 'GROUP' ? body.memberGroupId : null,
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

  async list(facilityId?: string) {
    const id = await this.facilityId(facilityId);
    const rows = await this.prisma.outreachCampaign.findMany({
      where: { facilityId: id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    });
    return this.withProgress(rows);
  }

  /** Per member: first contact for the campaign and what followed within the window. */
  private async memberResults(campaign: { id: string; memberIds: string[]; goal: string }) {
    const contacts = await this.prisma.memberOutreach.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'asc' },
    });
    const first = new Map<string, Date>();
    const lastChannel = new Map<string, string>();
    for (const c of contacts) {
      lastChannel.set(c.memberId, c.channel);
      if (c.channel !== 'SKIP' && !first.has(c.memberId)) first.set(c.memberId, c.createdAt);
    }
    const ids = [...first.keys()];
    const out = new Map<string, { contactedAt: Date | null; channel: string | null; won: boolean; revenue: number }>();
    for (const m of campaign.memberIds) {
      out.set(m, { contactedAt: first.get(m) ?? null, channel: lastChannel.get(m) ?? null, won: false, revenue: 0 });
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
            skipped: values.filter((v) => !v.contactedAt && v.channel === 'SKIP').length,
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
            channel: r?.channel ?? null,
            won: !!r?.won,
            revenue: r?.revenue ?? 0,
          };
        })
        .sort((a, b) => Number(!!a.contactedAt) - Number(!!b.contactedAt) || a.name.localeCompare(b.name)),
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
