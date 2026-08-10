import { BadRequestException } from '@nestjs/common';

/**
 * Набор начислений под заявку на вывод.
 *
 * Начисления неделимы: каждое — это конкретная закрытая сделка, и вывести
 * «половину сделки» нельзя. Поэтому запрошенная сумма далеко не всегда
 * набирается точно, и весь вопрос в том, что делать в этот момент.
 *
 * Раньше запрос на 349 090 000 при доступных 348 090 000 молча создавал
 * заявку на меньшую сумму — и экран честно писал «заявка принята», хотя
 * принята была другая. Для минимальной суммы мы отказ объясняли цифрами,
 * а здесь подменяли молча: одно и то же правило вело себя по-разному
 * в двух местах.
 *
 * Человек не должен узнавать об изменении своей суммы из выписки.
 *
 * ── Замечание о происхождении кода ───────────────────────────────────────
 * В продукте этот расчёт живёт внутри сервиса, вместе с транзакцией базы
 * и сохранением заявки. Здесь он вынесен в чистую функцию — без базы, без
 * репозиториев, — чтобы правило можно было проверить тестами. Сам расчёт
 * и тексты ошибок не изменены.
 */

export interface Accrual {
  id: string;
  /** Сумма начисления в сумах, целое */
  amount: number;
}

export interface SelectionResult {
  /** Какие именно начисления попадут в заявку */
  chosen: Accrual[];
  /** Их сумма — она и станет суммой заявки */
  sum: number;
}

/**
 * @param available   доступные начисления
 * @param requested   сколько просит человек; `undefined` — «всё доступное»
 * @param minAmount   минимальная сумма вывода
 */
export function selectAccruals(
  available: Accrual[],
  requested: number | undefined,
  minAmount: number,
): SelectionResult {
  const total = available.reduce((acc, t) => acc + Number(t.amount), 0);

  if (total === 0) {
    throw new BadRequestException('Нет начислений к выплате');
  }

  const target = requested ?? total;

  // Набираем целыми начислениями
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
      `Начисления не дробятся: минимальное составляет ${smallest} сум, запрошено ${target}`,
    );
  }

  if (sum < minAmount) {
    throw new BadRequestException(
      `Минимальная сумма вывода — ${minAmount} сум, доступно ${sum}`,
    );
  }

  // Расхождение не проглатывается: заявка либо на ту сумму, которую
  // назвал человек, либо её нет вовсе — с объяснением, что набирается
  if (requested !== undefined && sum !== requested) {
    throw new BadRequestException(
      `Доступно к выводу ${total} сум, целыми начислениями набирается ${sum}. ` +
        `Запросите ${sum} или оставьте сумму пустой, чтобы вывести всё доступное.`,
    );
  }

  return { chosen, sum };
}
