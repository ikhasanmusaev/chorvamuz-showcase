import { selectAccruals } from '../src/payouts/accrual-selection';

const MIN = 50_000;

const accruals = (...amounts: number[]) =>
  amounts.map((amount, i) => ({ id: `t${i}`, amount }));

describe('withdrawing everything available', () => {
  it('takes all accruals when no amount is given', () => {
    const result = selectAccruals(accruals(1_000_000, 2_000_000, 500_000), undefined, MIN);

    expect(result.sum).toBe(3_500_000);
    expect(result.chosen).toHaveLength(3);
  });

  it('an empty list is a refusal, not a request for zero', () => {
    expect(() => selectAccruals([], undefined, MIN)).toThrow(/Nothing accrued/);
  });
});

describe('a specific amount was requested', () => {
  it('adds up exactly — the request goes through', () => {
    const result = selectAccruals(accruals(1_000_000, 2_000_000), 3_000_000, MIN);

    expect(result.sum).toBe(3_000_000);
  });

  it('does not add up — refusal with numbers, not a silent substitution', () => {
    // The exact case: 349,090,000 requested, 348,090,000 available.
    // This used to silently create a request for the smaller amount
    expect(() => selectAccruals(accruals(348_090_000), 349_090_000, MIN)).toThrow(
      /whole accruals add up to 348090000/,
    );
  });

  it('the refusal names both numbers — the person needs each of them', () => {
    try {
      selectAccruals(accruals(300_000, 250_000), 400_000, MIN);
      fail('expected a refusal');
    } catch (err) {
      expect((err as Error).message).toContain('550000');
      expect((err as Error).message).toContain('300000');
    }
  });

  it('less than the smallest accrual — we explain indivisibility', () => {
    expect(() => selectAccruals(accruals(1_000_000), 400_000, MIN)).toThrow(
      /indivisible: the smallest one is 1000000/,
    );
  });
});

describe('minimum withdrawal amount', () => {
  it('below the minimum — refused', () => {
    expect(() => selectAccruals(accruals(10_000), undefined, MIN)).toThrow(
      /Minimum withdrawal is 50000/,
    );
  });

  it('exactly the minimum — allowed', () => {
    expect(selectAccruals(accruals(MIN), undefined, MIN).sum).toBe(MIN);
  });
});
