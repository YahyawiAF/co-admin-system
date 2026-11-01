import { activeWindow, parsePauses, pause, resume } from './pauses';

describe('pauses', () => {
  it('pauses and resumes on given days', () => {
    let p = pause([], '2026-11-03');
    expect(pause(p, '2026-11-04')).toBe(p);
    p = resume(p, '2026-11-06');
    expect(p).toEqual([{ from: '2026-11-03', to: '2026-11-05' }]);
    expect(resume(pause([], '2026-11-06'), '2026-11-06')).toEqual([]);
    expect(parsePauses([{ from: 'x' }, { from: '2026-11-01', to: null }])).toEqual([{ from: '2026-11-01', to: null }]);
  });

  it('skips paused days and pushes the window end later', () => {
    const start = new Date(2026, 10, 1);
    const limit = new Date(2026, 10, 30, 23);
    const w = activeWindow(start, 7, limit, [{ from: '2026-11-03', to: '2026-11-05' }], '2026-11-30');
    expect(w.activeDays).toBe(7);
    expect(w.pausedDays).toBe(3);
    expect(w.end!.getDate()).toBe(10);
    expect(w.skip(new Date(2026, 10, 4))).toBe(true);
    expect(w.skip(new Date(2026, 10, 6))).toBe(false);
  });

  it('stops at the start of an open pause', () => {
    const w = activeWindow(new Date(2026, 10, 1), 28, new Date(2026, 10, 9, 12), [{ from: '2026-11-05', to: null }], '2026-11-09');
    expect(w.activeDays).toBe(4);
    expect(w.end!.getDate()).toBe(4);
  });
});
