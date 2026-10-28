import {
  deriveRole,
  deriveSubjects,
  isVisible,
  normalizeSettings,
  validateAnswers,
  validateQuestions,
  type SurveyQuestion,
} from './survey-schema';
import { findTemplate } from './templates';

const learnShare = findTemplate('learn_share')!;
/** Errors of a refused answer (fails the test if it was accepted). */
const errorsOf = (r: ReturnType<typeof validateAnswers>) => {
  if (r.ok === true) throw new Error('expected a refusal');
  return (r as Extract<typeof r, { ok: false }>).errors;
};
const Q = learnShare.questions;

const learnerAnswers = {
  role: 'LEARN',
  learn_subjects: ['english', 'programming'],
  level: 'beginner',
  days: ['saturday'],
  times: ['morning', 'evening'],
  attend: 'yes',
};

describe('Learn & Share template', () => {
  it('is a valid question list for its own sections', () => {
    const r = validateQuestions(
      Q,
      learnShare.settings.sections.map((s) => s.id),
    );
    expect(r.ok).toBe(true);
  });

  it('hides volunteer questions from learners', () => {
    const teach = Q.find((q) => q.id === 'teach_subjects')!;
    expect(isVisible(teach, { role: 'LEARN' }, Q)).toBe(false);
    expect(isVisible(teach, { role: 'SHARE' }, Q)).toBe(true);
    expect(isVisible(teach, { role: 'BOTH' }, Q)).toBe(true);
  });
});

describe('validateAnswers', () => {
  it('accepts a complete learner answer and derives role and subjects', () => {
    const r = validateAnswers(Q, learnerAnswers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(deriveRole(Q, r.answers)).toBe('LEARN');
    expect(deriveSubjects(Q, r.answers)).toEqual(['english', 'programming']);
  });

  it('does not ask learners the volunteer-only required questions', () => {
    // teach_subjects / teach_time / host are required but hidden for LEARN
    expect(validateAnswers(Q, learnerAnswers).ok).toBe(true);
  });

  it('requires volunteer questions for volunteers', () => {
    const r = validateAnswers(Q, {
      role: 'SHARE',
      days: ['sunday'],
      times: ['evening'],
    });
    expect(
      errorsOf(r)
        .map((e) => e.questionId)
        .sort(),
    ).toEqual(['host', 'teach_subjects', 'teach_time']);
  });

  it('drops answers to hidden questions (learner sending volunteer data)', () => {
    const r = validateAnswers(Q, {
      ...learnerAnswers,
      teach_subjects: ['maths'],
      teach_experience: 'x',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answers.teach_subjects).toBeUndefined();
    expect(r.answers.teach_experience).toBeUndefined();
  });

  it('drops unknown keys', () => {
    const r = validateAnswers(Q, { ...learnerAnswers, hacked: 'x' });
    expect(r.ok && (r.answers as Record<string, unknown>).hacked).toBeFalsy();
  });

  it('rejects options that do not exist', () => {
    const r = validateAnswers(Q, { ...learnerAnswers, level: 'guru' });
    expect(errorsOf(r)[0]).toEqual({
      questionId: 'level',
      message: 'Choix invalide',
    });
  });

  it('reports missing required answers', () => {
    const r = validateAnswers(Q, { role: 'LEARN' });
    expect(errorsOf(r).map((e) => e.questionId)).toEqual([
      'learn_subjects',
      'days',
      'times',
      'attend',
    ]);
  });

  it('keeps the "other" text only when "other" is picked', () => {
    const withOther = validateAnswers(Q, {
      ...learnerAnswers,
      learn_subjects: ['other'],
      learn_subjects__other: '  Guitare  ',
    });
    expect(withOther.ok && withOther.answers.learn_subjects__other).toBe(
      'Guitare',
    );
    const without = validateAnswers(Q, {
      ...learnerAnswers,
      learn_subjects__other: 'Guitare',
    });
    expect(without.ok && without.answers.learn_subjects__other).toBeUndefined();
  });

  it('checks availability slots', () => {
    const base = {
      role: 'SHARE',
      days: ['sunday'],
      times: ['evening'],
      teach_subjects: ['maths'],
      teach_time: 'once',
      host: 'yes',
    };
    expect(
      validateAnswers(Q, {
        ...base,
        teach_slots: ['sat:morning', 'sun:evening'],
      }).ok,
    ).toBe(true);
    expect(
      validateAnswers(Q, { ...base, teach_slots: ['sat:midnight'] }).ok,
    ).toBe(false);
  });

  it('caps text length', () => {
    const base = {
      role: 'SHARE',
      days: ['sunday'],
      times: ['evening'],
      teach_subjects: ['maths'],
      teach_time: 'once',
      host: 'yes',
    };
    const r = validateAnswers(Q, {
      ...base,
      teach_experience: 'x'.repeat(2001),
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a missing answers object as empty', () => {
    const optionalOnly: SurveyQuestion[] = [
      { id: 'q', section: 'main', type: 'short', label: 'Q', required: false },
    ];
    expect(validateAnswers(optionalOnly, null)).toEqual({
      ok: true,
      answers: {},
    });
  });
});

describe('validateQuestions', () => {
  const sections = ['main'];
  it('needs at least two options for choices', () => {
    const r = validateQuestions(
      [
        {
          id: 'a',
          type: 'single',
          label: 'A',
          options: [{ value: 'x', label: 'X' }],
        },
      ],
      sections,
    );
    expect(r.ok).toBe(false);
  });

  it('refuses duplicate ids', () => {
    const q = { id: 'a', type: 'short', label: 'A' };
    expect(validateQuestions([q, q], sections).ok).toBe(false);
  });

  it('refuses a condition pointing to a later question', () => {
    const r = validateQuestions(
      [
        {
          id: 'a',
          type: 'short',
          label: 'A',
          showIf: { questionId: 'b', anyOf: ['x'] },
        },
        {
          id: 'b',
          type: 'single',
          label: 'B',
          options: [
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ],
        },
      ],
      sections,
    );
    expect(r.ok).toBe(false);
  });

  it('puts a question with an unknown section in the first section', () => {
    const r = validateQuestions(
      [{ id: 'a', type: 'short', label: 'A', section: 'nope' }],
      sections,
    );
    expect(r.ok && r.questions[0].section).toBe('main');
  });
});

describe('normalizeSettings', () => {
  it('fills defaults and clamps the attribution window', () => {
    const s = normalizeSettings({
      attributionDays: 9999,
      contactMode: 'WEIRD',
    });
    expect(s.attributionDays).toBe(180);
    expect(s.contactMode).toBe('OPTIONAL');
    expect(s.duplicatePolicy).toBe('LATEST_PER_BROWSER');
    expect(s.requireLogin).toBe(false);
  });
});
