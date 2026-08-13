import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OutboxStatus {
  /** Waiting to be sent, or waiting for the next attempt */
  PENDING = 'PENDING',
  /** Delivered */
  SENT = 'SENT',
  /** Attempts exhausted — a human takes it from here */
  FAILED = 'FAILED',
}

/**
 * Outgoing notification queue.
 *
 * Previously an unavailable delivery channel was written to `warn` and that was
 * the end of it: the person never received the message about their own money,
 * and there was nothing left to recover from — one line in a log, nothing in the
 * system. A notification about a payment cannot vanish because the receiving
 * process happened to be restarting at that moment.
 *
 * Now whatever was not delivered sits here and is retried on a schedule.
 */
@Entity('notification_outbox')
// The scheduler picks rows ready for another attempt — by status and due time
@Index(['status', 'nextAttemptAt'])
export class NotificationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'bigint' })
  recipientId: string;

  @Column({ type: 'text' })
  message: string;

  /** What happened — lets the receiving side pick the actions shown under the message */
  @Column({ type: 'varchar', length: 64, nullable: true })
  event: string | null;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Text of the last error — tells apart "channel is down" from "malformed payload" */
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ name: 'next_attempt_at', type: 'timestamp', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
