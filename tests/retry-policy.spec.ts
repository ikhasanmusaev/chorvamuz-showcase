import {
  MAX_ATTEMPTS,
  MAX_BACKOFF_MINUTES,
  backoffMinutes,
  nextStateAfterFailure,
} from '../src/reliable-delivery/retry-policy';

describe('delay between attempts', () => {
  it('doubles: 1, 2, 4, 8 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([1, 2, 4, 8]);
  });

  it('caps at an hour and grows no further', () => {
    expect(backoffMinutes(20)).toBe(MAX_BACKOFF_MINUTES);
  });

  it('the first retry waits no more than a minute — otherwise the user notices the gap', () => {
    expect(backoffMinutes(1)).toBe(1);
  });
});

describe('when to give up', () => {
  it('after a failure the row stays queued and gets a due time', () => {
    const next = nextStateAfterFailure(2);

    expect(next.status).toBe('PENDING');
    expect(next.attempts).toBe(3);
    expect(next.nextAttemptInMinutes).toBe(4);
  });

  it('on the last attempt it moves to FAILED and is not retried again', () => {
    const next = nextStateAfterFailure(MAX_ATTEMPTS - 1);

    expect(next.status).toBe('FAILED');
    expect(next.nextAttemptInMinutes).toBeNull();
  });

  it('a FAILED row is visible, not lost — a human picks it up', () => {
    // The point: giving up is allowed, losing the message is not. The row stays
    // in the queue, and the "N undelivered" summary is built from that status
    const next = nextStateAfterFailure(MAX_ATTEMPTS);

    expect(next.status).toBe('FAILED');
    expect(next.attempts).toBeGreaterThan(MAX_ATTEMPTS);
  });

  it('the whole retry cycle fits in roughly two hours', () => {
    const total = Array.from({ length: MAX_ATTEMPTS - 1 }, (_, i) => backoffMinutes(i + 1)).reduce(
      (a, b) => a + b,
      0,
    );

    // 1+2+4+8+16+32+60 = 123 minutes. Keeping someone in the dark longer than that
    // is not acceptable; past this point what is needed is an investigation, not a retry
    expect(total).toBeLessThan(180);
  });
});
