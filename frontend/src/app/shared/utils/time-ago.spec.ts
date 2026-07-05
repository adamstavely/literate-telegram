import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const daysAgo = (n: number): string =>
    new Date(Date.now() - n * 86_400_000).toISOString();

  it('returns the raw input for an unparseable date', () => {
    expect(timeAgo('not-a-date')).toBe('not-a-date');
  });

  it('labels the current moment as "today"', () => {
    expect(timeAgo(new Date().toISOString())).toBe('today');
  });

  it('labels ~1.5 days ago as "yesterday"', () => {
    expect(timeAgo(daysAgo(1.5))).toBe('yesterday');
  });

  it('labels a handful of days in "Nd ago" form', () => {
    expect(timeAgo(daysAgo(5))).toBe('5d ago');
  });

  it('labels a couple of months in "Nmo ago" form', () => {
    expect(timeAgo(daysAgo(60))).toBe('2mo ago');
  });
});
