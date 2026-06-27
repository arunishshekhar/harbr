import { Controller, Get, Param, Query, Res, NotFoundException, Inject } from '@nestjs/common';
import { Response } from 'express';
import { Pool } from 'pg';
import { KubeConfig, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  private logApi: Log;

  constructor(
    private logs: LogsService,
    @Inject('PG_POOL') private pool: Pool,
  ) {
    const kc = new KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? kc.loadFromCluster()
      : kc.loadFromDefault();
    this.logApi = new Log(kc);
  }

  /** SSE stream of live container logs for a project */
  @Get(':projectId/stream')
  async streamLogs(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const { rows: [project] } = await this.pool.query(
      'SELECT name, namespace FROM projects WHERE id = $1',
      [projectId],
    );
    if (!project) throw new NotFoundException('Project not found');

    // Find the first running pod for the project
    const { rows: [podRow] } = await this.pool.query(
      `SELECT name FROM nodes WHERE status = 'online' LIMIT 1`, // fallback
      [],
    );

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const namespace = project.namespace;
    const podName = project.name; // k8s pod label app=name

    const stream = new Writable({
      write(chunk: any, _enc: string, cb: Function) {
        const lines = chunk.toString('utf-8').split('\n');
        for (const line of lines) {
          if (line.trim()) {
            res.write(`data: ${line}\n\n`);
          }
        }
        cb();
      },
    });

    stream.on('error', () => res.end());
    res.on('close', () => stream.destroy());

    try {
      const controller = await this.logApi.log(
        namespace, podName, project.name, stream,
        { follow: true, tailLines: 100, timestamps: true },
      );
      res.on('close', () => controller.abort());
    } catch {
      // Pod not found or not yet running — send a message and close
      res.write(`data: [waiting for container to start...]\n\n`);
      res.end();
    }
  }

  /** Last build log for a project (from builds table) */
  @Get(':projectId/build')
  async buildLog(@Param('projectId') projectId: string) {
    const { rows: [build] } = await this.pool.query(
      `SELECT b.id, b.status, b.started_at, b.completed_at, b.error_message
       FROM builds b
       WHERE b.project_id = $1
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [projectId],
    );
    if (!build) return { log: '' };
    return { ...build, log: build.error_message ?? '' };
  }

  /** Loki query (generic) */
  @Get()
  async query(
    @Query('q') q: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.logs.query(q, start, end);
  }
}
