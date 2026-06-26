import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Pool } from 'pg';

@Processor('harbr-jobs')
export class JobsProcessor extends WorkerHost {
  constructor(@Inject('PG_POOL') private pool: Pool) {
    super();
  }

  async process(job: Job): Promise<any> {
    await this.pool.query(
      "UPDATE jobs SET status = 'active', started_at = NOW(), bullmq_id = $2 WHERE id = $1",
      [job.id, String(job.id)],
    );
    try {
      console.log(`[Worker] Processing job ${job.id}: ${job.name}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.pool.query(
        "UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1",
        [job.id],
      );
      return { processed: true };
    } catch (err: any) {
      await this.pool.query(
        "UPDATE jobs SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1",
        [job.id, err.message],
      );
      throw err;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`[Worker] Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    console.error(`[Worker] Job ${job.id} failed: ${err.message}`);
  }
}

@Injectable()
export class WorkerBootstrap implements OnApplicationBootstrap {
  constructor(
    @InjectQueue('harbr-jobs') private queue: Queue,
    @Inject('PG_POOL') private pool: Pool,
  ) {}

  async onApplicationBootstrap() {
    const { rows: stalled } = await this.pool.query(
      "SELECT * FROM jobs WHERE status IN ('active', 'stalled')",
    );
    for (const job of stalled) {
      await this.pool.query(
        "UPDATE jobs SET status = 'queued', started_at = NULL WHERE id = $1",
        [job.id],
      );
      await this.queue.add(job.type, job.payload, { jobId: job.id });
    }
    if (stalled.length > 0) {
      console.log(`[Worker] Re-queued ${stalled.length} stalled jobs`);
    }
  }
}
