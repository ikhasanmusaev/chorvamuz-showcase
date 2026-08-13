import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { NotificationOutbox, OutboxStatus } from './outbox.entity';
import { nextStateAfterFailure } from './retry-policy';

/** Delivery channel. An interface rather than a concrete client, so tests can substitute it */
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
   * Retry of deferred notifications.
   *
   * Once a minute: the channel is usually unavailable only briefly (a restart, a
   * deploy), and there is no reason to keep the person in the dark any longer
   * than necessary.
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
        // On a retry the event is restored from the queue: the recipient gets the
        // same message with the same actions as on the first attempt, rather than
        // bare text stripped of context
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
            `Notification ${row.id} undelivered after ${row.attempts} attempts: ${row.lastError}`,
          );
        } else {
          row.nextAttemptAt = new Date(Date.now() + next.nextAttemptInMinutes * 60_000);
        }
      }
      // Each row is saved on its own: one failed delivery must not roll back
      // the successful ones from the same batch
      await this.outboxRepo.save(row);
    }

    if (sent > 0) {
      this.logger.log(`Notification retry: delivered ${sent} of ${due.length}`);
    }
  }
}
