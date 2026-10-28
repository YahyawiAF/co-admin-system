import { buildFunnel, diagnose, type EventFunnelInput, type InitiativeStep } from './funnel';

/** The real case: boards bought, posts published, the registration link never shared. */
const chessSteps = (linkDone: boolean, waDone = false): InitiativeStep[] => [
  { text: 'Acheter 6 échiquiers', done: true },
  { text: 'Publier 3 posts échecs sur Instagram', done: true },
  { text: 'Mettre le lien d’inscription en story et en bio', done: linkDone },
  { text: 'Envoyer l’invitation WhatsApp aux membres', done: waDone },
];

const chessEvent = (over: Partial<EventFunnelInput> = {}): EventFunnelInput => ({
  kind: 'EVENT',
  channels: ['INSTAGRAM_POST', 'INSTAGRAM_STORY', 'WHATSAPP'],
  reach: 800,
  links: 0,
  opens: 0,
  registered: 0,
  paid: 0,
  price: 10,
  came: null,
  ...over,
});

describe('Conseiller funnel diagnosis', () => {
  it('chess, link never shared → not tested, broken at the link, idea not judged', () => {
    const d = diagnose({ steps: chessSteps(false), funnel: buildFunnel(chessEvent()), daysSinceStart: 8, price: 10 });
    expect(d.status).toBe('NOT_TESTED');
    expect(d.stage).toBe('opened');
    expect(d.brokenStep).toMatch(/lien/);
    expect(d.unproven.join(' ')).toMatch(/prix/i);
    expect(d.unproven.join(' ')).toMatch(/date/i);
    expect(d.known.join(' ')).toMatch(/800 vues/);
  });

  it('link shared, people open it, nobody registers → bottleneck at registration', () => {
    const d = diagnose({
      steps: chessSteps(true, true),
      funnel: buildFunnel(chessEvent({ links: 2, opens: 46 })),
      daysSinceStart: 8,
    });
    expect(d.status).toBe('BOTTLENECK');
    expect(d.stage).toBe('registered');
  });

  it('Instagram used but reach not typed → asks for the figure', () => {
    const d = diagnose({
      steps: chessSteps(true, true),
      funnel: buildFunnel(chessEvent({ reach: null, links: 1, opens: 30, registered: 4, paid: 3 })),
      daysSinceStart: 8,
    });
    expect(d.status).toBe('MISSING_DATA');
    expect(d.stage).toBe('seen');
  });

  it('everything done, registrations coming → on track, attendance still unknown', () => {
    const d = diagnose({
      steps: chessSteps(true, true),
      funnel: buildFunnel(chessEvent({ links: 3, opens: 64, registered: 9, paid: 7 })),
      daysSinceStart: 8,
    });
    expect(d.status).toBe('ON_TRACK');
    expect(d.unproven).toContain('Combien viendront vraiment');
  });

  it('all steps done but day 1 → too early, not a block', () => {
    const d = diagnose({
      steps: chessSteps(true, true),
      funnel: buildFunnel(chessEvent({ links: 1 })),
      daysSinceStart: 1,
    });
    expect(d.status).toBe('TOO_EARLY');
  });

  it('members register from the app without the link → the link stage is not the block', () => {
    const d = diagnose({
      steps: chessSteps(true, true),
      funnel: buildFunnel(chessEvent({ links: 1, opens: 0, registered: 5, paid: 0 })),
      daysSinceStart: 8,
    });
    expect(d.status).toBe('BOTTLENECK');
    expect(d.stage).toBe('paid');
  });

  it('action without a funnel and an undone step → not tested', () => {
    const d = diagnose({
      steps: [
        { text: 'Mettre l’affiche au comptoir', done: true },
        { text: 'Former l’équipe à proposer le pack', done: false },
      ],
      funnel: null,
      daysSinceStart: 10,
    });
    expect(d.status).toBe('NOT_TESTED');
    expect(d.brokenStep).toMatch(/Former/);
  });

  it('free event has no payment stage', () => {
    const stages = buildFunnel(chessEvent({ price: null, paid: null }))!;
    expect(stages.map((s) => s.key)).toEqual(['seen', 'opened', 'registered', 'came']);
  });
});
