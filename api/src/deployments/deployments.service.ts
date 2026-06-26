import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DeploymentsService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  async findAll(projectId?: string) {
    if (projectId) {
      const { rows } = await this.pool.query(
        'SELECT * FROM deployments WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId],
      );
      return rows;
    }
    const { rows } = await this.pool.query('SELECT * FROM deployments ORDER BY created_at DESC');
    return rows;
  }

  async findById(id: string) {
    const { rows } = await this.pool.query('SELECT * FROM deployments WHERE id = $1', [id]);
    return rows[0];
  }

  async executeK8sDeploy(payload: any) {
    const { deploymentId, projectId, imageTag } = payload;
    const { rows: [deployment] } = await this.pool.query(
      "UPDATE deployments SET status = 'running', started_at = NOW() WHERE id = $1 RETURNING *",
      [deploymentId],
    );
    const { rows: [project] } = await this.pool.query(
      "UPDATE projects SET project_status = 'running', observed_status = 'running' WHERE id = $1 RETURNING *",
      [projectId],
    );
    await this.pool.query(
      "UPDATE deployments SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [deploymentId],
    );
    return { project, deployment };
  }

  async createDeployment(projectId: string, buildId: string, imageTag: string, triggeredBy = 'manual', userId?: string) {
    const { rows: [deployment] } = await this.pool.query(
      `INSERT INTO deployments (project_id, build_id, image_tag, triggered_by, triggered_by_user)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [projectId, buildId, imageTag, triggeredBy, userId || null],
    );
    return deployment;
  }
}
