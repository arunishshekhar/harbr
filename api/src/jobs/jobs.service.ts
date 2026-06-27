import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Pool } from 'pg';

export interface EnqueueOptions {
  attempts?: number;
  backoff?: { type: string; delay: number };
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('harbr-jobs') private queue: Queue,
    @Inject('PG_POOL') private pool: Pool,
  ) {}

  async enqueue(
    name: string,
    payload: Record<string, any>,
    createdBy?: string,
    opts?: EnqueueOptions,
  ): Promise<string> {
    const bullJob = await this.queue.add(name, payload, {
      attempts: opts?.attempts ?? 3,
      backoff: opts?.backoff ?? { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
    });

    // Mirror to Postgres for audit trail
    const id = bullJob.id as string;
    await this.pool.query(
      `INSERT INTO jobs (id, type, payload, status, created_by)
       VALUES ($1, $2, $3, 'queued', $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, JSON.stringify(payload), createdBy ?? null],
    );

    return id;
  }

  async findAll(status?: string) {
    if (status) {
      const { rows } = await this.pool.query(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC LIMIT 100',
        [status],
      );
      return rows;
    }
    const { rows } = await this.pool.query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100');
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    return rows[0];
  }

  async markRunning(id: string): Promise<void> {
    await this.pool.query(
      "UPDATE jobs SET status = 'running', started_at = NOW() WHERE id = $1",
      [id],
    );
  }

  async markDone(id: string, result: any): Promise<void> {
    await this.pool.query(
      "UPDATE jobs SET status = 'success', result = $2, completed_at = NOW() WHERE id = $1",
      [id, JSON.stringify(result)],
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.pool.query(
      "UPDATE jobs SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1",
      [id, error],
    );
  }
}
