import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OutboxStatus {
  /** Ждёт отправки или следующей попытки */
  PENDING = 'PENDING',
  /** Доставлено */
  SENT = 'SENT',
  /** Попытки исчерпаны — дальше разбирается человек */
  FAILED = 'FAILED',
}

/**
 * Очередь исходящих уведомлений.
 *
 * Раньше недоступность внешнего канала писалась в `warn` и на этом всё
 * заканчивалось: человек не получал сообщение о своих деньгах, и восстановить
 * это было нечем — в логе строка, в системе ничего. Уведомление о платеже
 * не может исчезать оттого, что принимающий процесс в момент отправки
 * перезапускался.
 *
 * Теперь неотправленное лежит здесь и повторяется по расписанию.
 */
@Entity('notification_outbox')
// Планировщик выбирает готовые к повтору — по статусу и времени следующей попытки
@Index(['status', 'nextAttemptAt'])
export class NotificationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'bigint' })
  recipientId: string;

  @Column({ type: 'text' })
  message: string;

  /** Что произошло — принимающей стороне для выбора действий под сообщением */
  @Column({ type: 'varchar', length: 64, nullable: true })
  event: string | null;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Текст последней ошибки — по нему видно, канал лежит или тело кривое */
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
