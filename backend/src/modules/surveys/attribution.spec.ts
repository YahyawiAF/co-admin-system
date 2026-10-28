import {
  attributionFromVisit,
  cleanToken,
  DIRECT_SOURCE,
  resolveAttribution,
  type TrackedLink,
} from './attribution';

const igStory: TrackedLink = {
  id: 'link-1',
  channel: 'INSTAGRAM_STORY',
  source: 'instagram',
  medium: 'story',
  campaign: 'learn_share_2026',
  content: null,
  term: null,
};

const day = 24 * 3600 * 1000;

describe('attributionFromVisit', () => {
  it('tracked link wins over UTM parameters', () => {
    const a = attributionFromVisit(igStory, {
      utm_source: 'facebook',
      utm_medium: 'post',
      utm_content: 'reel_2',
    });
    expect(a).toMatchObject({
      linkId: 'link-1',
      source: 'instagram',
      medium: 'story',
      content: 'reel_2',
      method: 'LINK',
    });
  });

  it('UTM only (link built by hand)', () => {
    const a = attributionFromVisit(null, {
      utm_source: 'WhatsApp',
      utm_medium: 'community',
      utm_campaign: 'Learn Share 2026',
    });
    expect(a).toMatchObject({
      linkId: null,
      source: 'whatsapp',
      medium: 'community',
      campaign: 'learn_share_2026',
      method: 'UTM',
    });
  });

  it('plain URL → direct_or_unknown, nothing invented', () => {
    expect(attributionFromVisit(null, {})).toMatchObject({
      source: DIRECT_SOURCE,
      medium: null,
      method: 'DIRECT',
    });
  });

  it('garbage parameters → direct_or_unknown', () => {
    expect(
      attributionFromVisit(null, { utm_source: '<<<>>>', utm_medium: 42 }),
    ).toMatchObject({ source: DIRECT_SOURCE, method: 'DIRECT' });
  });
});

describe('resolveAttribution (first touch)', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  const stored = (method: 'LINK' | 'UTM' | 'DIRECT', daysAgo: number) => ({
    ...(method === 'DIRECT'
      ? attributionFromVisit(null)
      : attributionFromVisit(igStory)),
    firstSeenAt: new Date(now.getTime() - daysAgo * day),
  });

  it('new browser takes this visit', () => {
    const r = resolveAttribution(attributionFromVisit(igStory), null, 30, now);
    expect(r).toMatchObject({
      replaced: true,
      attribution: { source: 'instagram' },
    });
  });

  it('returning by a plain URL keeps the campaign', () => {
    const r = resolveAttribution(
      attributionFromVisit(null),
      stored('LINK', 3),
      30,
      now,
    );
    expect(r).toMatchObject({
      replaced: false,
      attribution: { source: 'instagram', linkId: 'link-1' },
    });
  });

  it('a second campaign inside the window does not steal the credit', () => {
    const r = resolveAttribution(
      attributionFromVisit(null, { utm_source: 'whatsapp' }),
      stored('LINK', 3),
      30,
      now,
    );
    expect(r.attribution.source).toBe('instagram');
  });

  it('a known source upgrades an earlier direct visit', () => {
    const r = resolveAttribution(
      attributionFromVisit(igStory),
      stored('DIRECT', 1),
      30,
      now,
    );
    expect(r).toMatchObject({
      replaced: true,
      attribution: { source: 'instagram' },
    });
  });

  it('after the window a new campaign takes over', () => {
    const r = resolveAttribution(
      attributionFromVisit(null, { utm_source: 'whatsapp' }),
      stored('LINK', 40),
      30,
      now,
    );
    expect(r).toMatchObject({
      replaced: true,
      attribution: { source: 'whatsapp', method: 'UTM' },
    });
  });

  it('after the window a plain visit is direct again', () => {
    const r = resolveAttribution(
      attributionFromVisit(null),
      stored('LINK', 40),
      30,
      now,
    );
    expect(r.attribution).toMatchObject({
      source: DIRECT_SOURCE,
      linkId: null,
    });
  });
});

describe('cleanToken', () => {
  it('lower-cases, strips accents and odd characters', () => {
    expect(cleanToken('  Club Étudiant ENIT! ')).toBe('club_etudiant_enit');
    expect(cleanToken('')).toBeNull();
    expect(cleanToken(undefined)).toBeNull();
  });
});
