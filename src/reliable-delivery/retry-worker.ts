import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { NotificationOutbox, OutboxStatus } from './outbox.entity';
import { nextStateAfterFailure } from './retry-policy';

/** Канал доставки. Интерфейс, а не конкретный клиент — чтобы подменялся в тестах */
export interface NotificationTransport {
  notify(recipientId: number, message: string, meta?: { event?: string }): Promise<void>;
}

@Injectable()
export class RetryWorker {
  private readonly logger = new Logger(RetryWorker.name);
  private transport: NotificationTransport | null = null;

  constructor(
    @InjectRepository(NotificationOutbox)
    private readonly outboxRepo: Repository<NotificationOutbox>,
  ) {}

  /**
   * Повтор отложенных уведомлений.
   *
   * Раз в минуту: канал обычно недоступен недолго (перезапуск, деплой),
   * и держать человека в неведении дольше необходимого незачем.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryPending(): Promise<void> {
    if (!this.transport) return;

    const due = await this.outboxRepo.find({
      where: { status: OutboxStatus.PENDING, nextAttemptAt: LessThanOrEqual(new Date()) },
      order: { nextAttemptAt: 'ASC' },
      take: 100,
    });
    if (due.length === 0) return;

    let sent = 0;
    for (const row of due) {
      try {
        // При повторе событие восстанавливается из очереди: получатель увидит
        // то же сообщение с теми же действиями, что и при первой попытке,
        // а не голый текст без контекста
        await this.transport.notify(Number(row.recipientId), row.message, {
          event: row.event ?? undefined,
        });
        row.status = OutboxStatus.SENT;
        row.sentAt = new Date();
        row.lastError = null;
        sent++;
      } catch (err) {
        const next = nextStateAfterFailure(row.attempts);
        row.attempts = next.attempts;
        row.lastError = (err as Error).message.slice(0, 500);
        row.status = next.status as OutboxStatus;

        if (next.nextAttemptInMinutes === null) {
          this.logger.error(
            `Уведомление ${row.id} не доставлено за ${row.attempts} попыток: ${row.lastError}`,
          );
        } else {
          row.nextAttemptAt = new Date(Date.now() + next.nextAttemptInMinutes * 60_000);
        }
      }
      // Сохраняем каждую строку отдельно: одна упавшая доставка не должна
      // откатывать успешные из той же пачки
      await this.outboxRepo.save(row);
    }

    if (sent > 0) {
      this.logger.log(`Повтор уведомлений: доставлено ${sent} из ${due.length}`);
    }
  }
}
