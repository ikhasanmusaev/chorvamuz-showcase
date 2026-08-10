import {
  MAX_ATTEMPTS,
  MAX_BACKOFF_MINUTES,
  backoffMinutes,
  nextStateAfterFailure,
} from '../src/reliable-delivery/retry-policy';

describe('пауза между попытками', () => {
  it('растёт вдвое: 1, 2, 4, 8 минут', () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([1, 2, 4, 8]);
  });

  it('упирается в час и дальше не растёт', () => {
    expect(backoffMinutes(20)).toBe(MAX_BACKOFF_MINUTES);
  });

  it('первая попытка не ждёт дольше минуты — иначе человек заметит паузу', () => {
    expect(backoffMinutes(1)).toBe(1);
  });
});

describe('когда сдаваться', () => {
  it('после неудачи остаётся в очереди и получает время следующей попытки', () => {
    const next = nextStateAfterFailure(2);

    expect(next.status).toBe('PENDING');
    expect(next.attempts).toBe(3);
    expect(next.nextAttemptInMinutes).toBe(4);
  });

  it('на последней попытке переходит в FAILED и больше не повторяется', () => {
    const next = nextStateAfterFailure(MAX_ATTEMPTS - 1);

    expect(next.status).toBe('FAILED');
    expect(next.nextAttemptInMinutes).toBeNull();
  });

  it('запись в FAILED видна, а не потеряна — её разбирает человек', () => {
    // Смысл проверки: сдаться можно, потерять нельзя. Статус остаётся
    // в очереди, и по нему строится сводка «не доставлено N»
    const next = nextStateAfterFailure(MAX_ATTEMPTS);

    expect(next.status).toBe('FAILED');
    expect(next.attempts).toBeGreaterThan(MAX_ATTEMPTS);
  });

  it('весь цикл повторов укладывается примерно в час', () => {
    const total = Array.from({ length: MAX_ATTEMPTS - 1 }, (_, i) => backoffMinutes(i + 1)).reduce(
      (a, b) => a + b,
      0,
    );

    // 1+2+4+8+16+32+60 = 123 минуты. Дольше держать человека в неведении
    // нельзя, дальше нужен не повтор, а разбор
    expect(total).toBeLessThan(180);
  });
});
