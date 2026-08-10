import { selectAccruals } from '../src/payouts/accrual-selection';

const MIN = 50_000;

const accruals = (...amounts: number[]) =>
  amounts.map((amount, i) => ({ id: `t${i}`, amount }));

describe('вывод всего доступного', () => {
  it('без указанной суммы забирает все начисления', () => {
    const result = selectAccruals(accruals(1_000_000, 2_000_000, 500_000), undefined, MIN);

    expect(result.sum).toBe(3_500_000);
    expect(result.chosen).toHaveLength(3);
  });

  it('пустой список — это отказ, а не заявка на ноль', () => {
    expect(() => selectAccruals([], undefined, MIN)).toThrow(/Нет начислений/);
  });
});

describe('запрошена конкретная сумма', () => {
  it('набирается точно — заявка проходит', () => {
    const result = selectAccruals(accruals(1_000_000, 2_000_000), 3_000_000, MIN);

    expect(result.sum).toBe(3_000_000);
  });

  it('не набирается точно — отказ с цифрами, а не молчаливая подмена', () => {
    // Тот самый случай: просили 349 090 000, доступно 348 090 000.
    // Раньше здесь молча создавалась заявка на меньшую сумму
    expect(() => selectAccruals(accruals(348_090_000), 349_090_000, MIN)).toThrow(
      /целыми начислениями набирается 348090000/,
    );
  });

  it('в тексте отказа есть и доступное, и набираемое — человеку нужны оба числа', () => {
    try {
      selectAccruals(accruals(300_000, 250_000), 400_000, MIN);
      fail('ожидался отказ');
    } catch (err) {
      expect((err as Error).message).toContain('550000');
      expect((err as Error).message).toContain('300000');
    }
  });

  it('запрошено меньше самого мелкого начисления — объясняем неделимость', () => {
    expect(() => selectAccruals(accruals(1_000_000), 400_000, MIN)).toThrow(
      /не дробятся: минимальное составляет 1000000/,
    );
  });
});

describe('минимальная сумма вывода', () => {
  it('ниже минимума — отказ', () => {
    expect(() => selectAccruals(accruals(10_000), undefined, MIN)).toThrow(
      /Минимальная сумма вывода — 50000/,
    );
  });

  it('ровно минимум — проходит', () => {
    expect(selectAccruals(accruals(MIN), undefined, MIN).sum).toBe(MIN);
  });
});
