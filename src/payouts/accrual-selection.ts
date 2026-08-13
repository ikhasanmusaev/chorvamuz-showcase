import { BadRequestException } from '@nestjs/common';

/**
 * Selecting accruals for a withdrawal request.
 *
 * Accruals are indivisible: each one is a specific closed deal, and "half a deal"
 * cannot be withdrawn. So a requested amount rarely adds up exactly, and the whole
 * question is what to do at that moment.
 *
 * Previously a request for 349,090,000 against 348,090,000 available silently
 * created a request for the smaller amount — and the screen truthfully said
 * "request accepted", when a different request had been accepted. For the minimum
 * amount we explained the refusal with numbers; here we substituted silently. One
 * rule, behaving differently in two places.
 *
 * Nobody should learn their amount changed by reading a statement.
 *
 * ── A note on where this code comes from ─────────────────────────────────────
 * In the product this calculation lives inside a service, together with the
 * database transaction and saving the request. Here it is extracted into a pure
 * function — no database, no repositories — so the rule can be covered by tests.
 * The calculation and the error messages are unchanged (translated from Russian).
 */

export interface Accrual {
  id: string;
  /** Accrual amount in UZS, integer */
  amount: number;
}

export interface SelectionResult {
  /** Which accruals go into the request */
  chosen: Accrual[];
  /** Their total — this becomes the amount of the request */
  sum: number;
}

/**
 * @param available   accruals available for withdrawal
 * @param requested   how much the person asks for; `undefined` means "everything available"
 * @param minAmount   minimum withdrawal amount
 */
export function selectAccruals(
  available: Accrual[],
  requested: number | undefined,
  minAmount: number,
): SelectionResult {
  const total = available.reduce((acc, t) => acc + Number(t.amount), 0);

  if (total === 0) {
    throw new BadRequestException('Nothing accrued to pay out');
  }

  const target = requested ?? total;

  // Filling up with whole accruals
  const chosen: Accrual[] = [];
  let sum = 0;
  for (const t of available) {
    const value = Number(t.amount);
    if (sum + value > target) continue;
    chosen.push(t);
    sum += value;
  }

  if (sum === 0) {
    const smallest = Math.min(...available.map((t) => Number(t.amount)));
    throw new BadRequestException(
      `Accruals are indivisible: the smallest one is ${smallest} UZS, requested ${target}`,
    );
  }

  if (sum < minAmount) {
    throw new BadRequestException(
      `Minimum withdrawal is ${minAmount} UZS, available ${sum}`,
    );
  }

  // The discrepancy is not swallowed: either the request is for the amount the
  // person named, or there is no request at all — with an explanation of what does add up
  if (requested !== undefined && sum !== requested) {
    throw new BadRequestException(
      `Available for withdrawal: ${total} UZS, whole accruals add up to ${sum}. ` +
        `Request ${sum}, or leave the amount empty to withdraw everything available.`,
    );
  }

  return { chosen, sum };
}
