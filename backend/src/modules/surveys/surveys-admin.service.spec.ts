// Jest here has no `database/*` path alias; the service only needs the type.
jest.mock('database/prisma.service', () => ({ PrismaService: class {} }), {
  virtual: true,
});

// Only the pure helpers are tested here: the staff permission check is not needed.
jest.mock('../staff/staff.service', () => ({ StaffService: class {} }));

import {
  completionRate,
  csvCell,
  respondentType,
} from './surveys-admin.service';

describe('respondentType', () => {
  const at = new Date('2026-10-20T10:00:00Z');
  it('client before answering', () => {
    expect(
      respondentType({
        memberId: 'm',
        contactPhone: null,
        createdAt: at,
        member: { createdAt: new Date('2026-01-01') },
      }),
    ).toBe('MEMBER');
  });
  it('became a client after answering', () => {
    expect(
      respondentType({
        memberId: 'm',
        contactPhone: '+216',
        createdAt: at,
        member: { createdAt: new Date('2026-10-21') },
      }),
    ).toBe('NEW_MEMBER');
  });
  it('left a number only', () => {
    expect(
      respondentType({
        memberId: null,
        contactPhone: '+21622123456',
        createdAt: at,
      }),
    ).toBe('KNOWN');
  });
  it('nothing known', () => {
    expect(
      respondentType({ memberId: null, contactPhone: null, createdAt: at }),
    ).toBe('ANONYMOUS');
  });
});

describe('csvCell', () => {
  it('keeps phone numbers as they are', () => {
    expect(csvCell('+21622123456')).toBe('+21622123456');
    expect(csvCell('-5')).toBe('-5');
  });
  it('neutralises spreadsheet formulas typed by respondents', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('quotes separators and line breaks', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });
});

describe('completionRate', () => {
  it('is responses ÷ started', () => {
    expect(completionRate(37, 54)).toBe(69);
  });
  it('is empty when nobody started', () => {
    expect(completionRate(0, 0)).toBeNull();
  });
  it('never goes above 100 % when one browser answers twice', () => {
    expect(completionRate(3, 2)).toBe(100);
  });
});
