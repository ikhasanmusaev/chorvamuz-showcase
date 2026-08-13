/**
 * Retry policy for the notification queue.
 *
 * Deliberately kept in its own module: this is the only part of delivery that can
 * be verified without a database and without a network, and the easiest part to
 * get wrong. See `tests/retry-policy.spec.ts`, where it is verified.
 */

/**
 * How many times we try before calling a human.
 *
 * Eight attempts with a growing delay is a little over an hour. Retrying past that
 * is pointless: if the channel has been unavailable for an hour it is not a network
 * hiccup but a breakage, and what is needed is not a ninth request but a person.
 */
export const MAX_ATTEMPTS = 8;

/** Never wait longer than an hour: a message about money that is two hours late is already useless */
export const MAX_BACKOFF_MINUTES = 60;

/**
 * Delay before the next attempt: 1, 2, 4, 8… minutes, capped at an hour.
 *
 * Exponential rather than a fixed interval: the typical cause of failure is a
 * restart or a deploy on the receiving side, which takes seconds. The first retry
 * has to be fast so the user never notices. But if the channel is genuinely down,
 * hammering it once a minute keeps it from coming back up.
 */
export function backoffMinutes(attempts: number): number {
  return Math.min(MAX_BACKOFF_MINUTES, 2 ** Math.max(0, attempts - 1));
}

/** Outcome of one attempt — what to write back to the queue row */
export interface NextState {
  status: 'PENDING' | 'FAILED';
  attempts: number;
  nextAttemptInMinutes: number | null;
}

/**
 * Where a row goes after a failed attempt.
 *
 * A pure function rather than an `if` inside the worker loop: this is where the
 * "when to give up" rule lives, and it has to be verifiable in isolation from the
 * database, the transport and the scheduler.
 */
export function nextStateAfterFailure(currentAttempts: number): NextState {
  const attempts = currentAttempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    // Not "one more time": this many attempts within an hour is no longer a network
    // problem, and the row has to stay visible instead of quietly going round again
    return { status: 'FAILED', attempts, nextAttemptInMinutes: null };
  }

  return { status: 'PENDING', attempts, nextAttemptInMinutes: backoffMinutes(attempts) };
}
