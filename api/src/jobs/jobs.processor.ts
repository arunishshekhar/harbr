import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { KanikoService } from '../builds/kaniko.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { JobsService } from './jobs.service';

@Processor('harbr-jobs')
@Injectable()
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private kanikoService: KanikoService,
    private deploymentsService: DeploymentsService,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);
    await this.jobsService.markRunning(job.id as string);

    try {
      let result: any;

      switch (job.name) {
        case 'build':
          await this.kanikoService.executeKanikoJob(job.data);
          result = { status: 'built', buildId: job.data.buildId };
          break;

        case 'deploy':
          await this.deploymentsService.applyToK3s(job.data);
          result = { status: 'deployed', projectId: job.data.projectId };
          break;

        case 'backup':
          this.logger.warn('Backup job not yet implemented');
          result = { status: 'skipped' };
          break;

        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
          result = { status: 'unknown' };
      }

      await this.jobsService.markDone(job.id as string, result);
      return result;
    } catch (err: any) {
      this.logger.error(`Job ${job.id} failed: ${err.message}`);
      await this.jobsService.markFailed(job.id as string, err.message);
      throw err;
    }
  }
}
