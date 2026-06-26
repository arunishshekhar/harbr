import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BuildsService {
  constructor(
    @Inject('PG_POOL') private pool: Pool,
    @InjectQueue('harbr-jobs') private queue: Queue,
  ) {}

  async findAll(projectId?: string) {
    if (projectId) {
      const { rows } = await this.pool.query(
        'SELECT * FROM builds WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      );
      return rows;
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM builds ORDER BY created_at DESC',
    );
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM builds WHERE id = $1', [id]);
    return rows[0];
  }

  async triggerBuild(projectId: string, triggeredBy = 'manual', userId?: string, webhookDeliveryId?: string) {
    const { rows: [project] } = await this.pool.query(
      "SELECT * FROM projects WHERE id = $1 AND project_status NOT IN ('building', 'deploying')",
      [projectId],
    );
    if (!project) {
      throw new ConflictException('Project has an active build or deploy in progress');
    }

    const { rows: [build] } = await this.pool.query(
      `INSERT INTO builds (project_id, git_commit, git_branch, triggered_by, triggered_by_user, webhook_delivery_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [projectId, null, project.git_branch, triggeredBy, userId || null, webhookDeliveryId || null],
    );

    await this.queue.add('build', {
      buildId: build.id,
      projectId: project.id,
      gitUrl: project.git_url,
      gitBranch: project.git_branch,
      gitCredentialsSecret: project.git_credentials_secret,
      gitCredentialsType: project.git_credentials_type,
      buildSecretsSecret: project.build_secrets_secret,
      port: project.port,
    }, { jobId: build.id });

    return build;
  }
}
