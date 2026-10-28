import { BadRequestException, NotFoundException } from '@nestjs/common';

// Jest here has no `database/*` path alias; the service only needs the type.
jest.mock('database/prisma.service', () => ({ PrismaService: class {} }), {
  virtual: true,
});

import { Prisma } from '@prisma/client';
import { SurveysPublicService } from './surveys-public.service';
import { findTemplate } from './templates';

/** Just enough of Prisma for the public flow, kept in memory. */
function fakePrisma() {
  const t = findTemplate('learn_share')!;
  const db = {
    surveys: [
      {
        id: 's1',
        slug: 'learn-and-share',
        status: 'PUBLISHED',
        closesAt: null as Date | null,
        title: t.title,
        intro: t.intro,
        description: null,
        questions: t.questions,
        settings: t.settings,
        facility: { organizationId: 'org1' },
        orgSlug: 'collabora',
        createdAt: new Date(),
      },
    ],
    links: [
      {
        id: 'L1',
        code: 'abc234',
        kind: 'SURVEY',
        targetId: 's1',
        channel: 'INSTAGRAM_STORY',
        source: 'instagram',
        medium: 'story',
        campaign: 'ls',
        content: null,
        term: null,
        opens: 0,
      },
      {
        id: 'L2',
        code: 'zzz234',
        kind: 'SURVEY',
        targetId: 'other-survey',
        channel: 'WHATSAPP',
        source: 'whatsapp',
        medium: 'community',
        campaign: 'x',
        content: null,
        term: null,
        opens: 0,
      },
    ],
    visits: [] as any[],
    responses: [] as any[],
    members: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: 'org1',
        deletedAt: null,
      },
    ],
  };
  let n = 0;
  const match = (row: any, where: any): boolean =>
    Object.entries(where || {}).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && !(v instanceof Date) && 'not' in v)
        return row[k] !== v.not;
      return row[k] === v;
    });
  const prisma: any = {
    survey: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          db.surveys.find(
            (s) =>
              s.slug === where.slug &&
              s.status !== where.status.not &&
              s.orgSlug === where.facility.organization.slug,
          ) ?? null,
      ),
    },
    shareLink: {
      findUnique: jest.fn(
        async ({ where }: any) =>
          db.links.find((l) => l.code === where.code) ?? null,
      ),
      update: jest.fn(async ({ where }: any) => {
        const l = db.links.find((x) => x.id === where.id)!;
        l.opens++;
        return l;
      }),
    },
    surveyVisit: {
      findUnique: jest.fn(
        async ({ where }: any) =>
          db.visits.find(
            (v) =>
              v.surveyId === where.surveyId_visitorKey.surveyId &&
              v.visitorKey === where.surveyId_visitorKey.visitorKey,
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const v = {
          id: `v${++n}`,
          firstSeenAt: new Date(),
          startedAt: null,
          submittedAt: null,
          ...data,
        };
        db.visits.push(v);
        return v;
      }),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          db.visits.find((v) => v.id === where.id),
          data,
        ),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = db.visits.filter((v) => match(v, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    surveyResponse: {
      findUnique: jest.fn(
        async ({ where }: any) =>
          db.responses.find((r) => r.idempotencyKey === where.idempotencyKey) ??
          null,
      ),
      create: jest.fn(async ({ data }: any) => {
        if (
          db.responses.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const r = {
          id: `r${++n}`,
          supersededAt: null,
          createdAt: new Date(),
          ...data,
        };
        db.responses.push(r);
        return r;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = db.responses.filter((r) => match(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    },
    member: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          db.members.find(
            (m) =>
              m.id === where.id && m.organizationId === where.organizationId,
          ) ?? null,
      ),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma, db };
}

const learner = {
  role: 'LEARN',
  learn_subjects: ['english'],
  days: ['saturday'],
  times: ['morning'],
  attend: 'yes',
};
const KEY = 'visitor-key-0001';

function submitDto(over: Record<string, unknown> = {}) {
  return {
    visitorKey: KEY,
    idempotencyKey: `idem-${Math.random().toString(36).slice(2, 12)}`,
    answers: learner,
    elapsedMs: 40_000,
    ...over,
  } as any;
}

describe('SurveysPublicService', () => {
  let svc: SurveysPublicService;
  let db: ReturnType<typeof fakePrisma>['db'];

  beforeEach(() => {
    const f = fakePrisma();
    db = f.db;
    svc = new SurveysPublicService(f.prisma);
  });

  it('serves the questions of a published survey without login', async () => {
    const s = await svc.get('collabora', 'learn-and-share');
    expect(s.open).toBe(true);
    expect(s.questions.length).toBeGreaterThan(5);
    expect(s).not.toHaveProperty('responses');
  });

  it('drafts do not exist publicly', async () => {
    db.surveys[0].status = 'DRAFT';
    await expect(
      svc.get('collabora', 'learn-and-share'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a closed survey shows as closed and refuses answers', async () => {
    db.surveys[0].status = 'CLOSED';
    const s = await svc.get('collabora', 'learn-and-share');
    expect(s.open).toBe(false);
    expect(s.questions).toEqual([]);
    await expect(
      svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a survey past its closing date refuses answers', async () => {
    db.surveys[0].closesAt = new Date(Date.now() - 1000);
    await expect(
      svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Instagram link: open counted once, attribution saved on the answer', async () => {
    await svc.visit(
      'collabora',
      'learn-and-share',
      { visitorKey: KEY, c: 'abc234', firstOpen: true },
      '1.1.1.1',
    );
    await svc.visit(
      'collabora',
      'learn-and-share',
      { visitorKey: KEY, c: 'abc234', firstOpen: false },
      '1.1.1.1',
    );
    expect(db.links[0].opens).toBe(1);
    // Comes back later on the plain URL and answers
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    expect(db.responses[0]).toMatchObject({
      linkId: 'L1',
      source: 'instagram',
      medium: 'story',
      method: 'LINK',
      role: 'LEARN',
      subjects: ['english'],
    });
  });

  it('a submitted survey always counts as started', async () => {
    await svc.visit(
      'collabora',
      'learn-and-share',
      { visitorKey: KEY },
      '1.1.1.1',
    );
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    expect(db.visits[0].startedAt).toBeInstanceOf(Date);
    expect(db.visits[0].submittedAt).toBeInstanceOf(Date);
  });

  it('a link code of another survey is ignored (unknown source, answer accepted)', async () => {
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ c: 'zzz234' }),
      '1.1.1.1',
    );
    expect(db.responses[0]).toMatchObject({
      linkId: null,
      source: 'direct_or_unknown',
      method: 'DIRECT',
    });
    expect(db.links[1].opens).toBe(0);
  });

  it('UTM parameters without a code are kept', async () => {
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ utm_source: 'whatsapp', utm_medium: 'community' }),
      '1.1.1.1',
    );
    expect(db.responses[0]).toMatchObject({
      source: 'whatsapp',
      medium: 'community',
      method: 'UTM',
    });
  });

  it('plain URL → direct_or_unknown', async () => {
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    expect(db.responses[0].source).toBe('direct_or_unknown');
  });

  it('double tap / network retry with the same key → one answer', async () => {
    const dto = submitDto();
    const a = await svc.submit('collabora', 'learn-and-share', dto, '1.1.1.1');
    const b = await svc.submit('collabora', 'learn-and-share', dto, '1.1.1.1');
    expect(b).toMatchObject({ id: a.id, deduplicated: true });
    expect(db.responses).toHaveLength(1);
  });

  it('two concurrent submits with the same key → one answer', async () => {
    const dto = submitDto();
    const [a, b] = await Promise.all([
      svc.submit('collabora', 'learn-and-share', dto, '1.1.1.1'),
      svc.submit('collabora', 'learn-and-share', dto, '1.1.1.1'),
    ]);
    expect(a.id).toBe(b.id);
    expect(db.responses).toHaveLength(1);
  });

  it('same browser answers again: old answer kept but marked replaced', async () => {
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    expect(db.responses).toHaveLength(2);
    expect(db.responses[0].supersededAt).toBeInstanceOf(Date);
    expect(db.responses[1].supersededAt).toBeNull();
  });

  it('KEEP_ALL policy keeps every answer counted', async () => {
    db.surveys[0].settings = {
      ...db.surveys[0].settings,
      duplicatePolicy: 'KEEP_ALL',
    };
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    await svc.submit('collabora', 'learn-and-share', submitDto(), '1.1.1.1');
    expect(db.responses.every((r) => r.supersededAt === null)).toBe(true);
  });

  it('honeypot or too-fast answer is stored flagged, not rejected', async () => {
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ hp: 'http://spam' }),
      '1.1.1.1',
    );
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ visitorKey: 'visitor-key-0002', elapsedMs: 500 }),
      '1.1.1.1',
    );
    expect(db.responses.map((r) => r.flagged)).toEqual([true, true]);
  });

  it('invalid answers are refused with the question ids', async () => {
    const err = await svc
      .submit(
        'collabora',
        'learn-and-share',
        submitDto({ answers: { role: 'LEARN' } }),
        '1.1.1.1',
      )
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse().errors.map((e: any) => e.questionId)).toContain(
      'learn_subjects',
    );
  });

  it('contact: valid Tunisian WhatsApp with consent is normalised', async () => {
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({
        contact: { name: 'Amel', phone: '22 123 456', consent: true },
      }),
      '1.1.1.1',
    );
    expect(db.responses[0]).toMatchObject({
      contactName: 'Amel',
      contactPhone: '+21622123456',
    });
    expect(db.responses[0].contactConsentAt).toBeInstanceOf(Date);
  });

  it('contact: a number without consent is refused', async () => {
    await expect(
      svc.submit(
        'collabora',
        'learn-and-share',
        submitDto({ contact: { phone: '22123456' } }),
        '1.1.1.1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('known member of this organization is linked (method SESSION)', async () => {
    const memberId = '11111111-1111-4111-8111-111111111111';
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ memberId }),
      '1.1.1.1',
    );
    expect(db.responses[0]).toMatchObject({
      memberId,
      memberLinkMethod: 'SESSION',
    });
  });

  it('a member id from elsewhere is ignored', async () => {
    await svc.submit(
      'collabora',
      'learn-and-share',
      submitDto({ memberId: '22222222-2222-4222-8222-222222222222' }),
      '1.1.1.1',
    );
    expect(db.responses[0].memberId).toBeNull();
  });
});
