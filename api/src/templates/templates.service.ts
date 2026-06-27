import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Pool } from 'pg';
import { BuildsService } from '../builds/builds.service';
import { ProjectsService } from '../projects/projects.service';

// ─── Stack component definitions (images + env for sidecar services) ──────────

const STACK_COMPONENTS: Record<string, {
  image: string;
  port: number;
  env?: Record<string, string>;
  volumes?: Array<{ name: string; mountPath: string; size: string }>;
  suffix: string;
}> = {
  redis7: {
    image: 'redis:7.4-alpine',
    port: 6379,
    suffix: '-redis',
  },
  redis6: {
    image: 'redis:6.2-alpine',
    port: 6379,
    suffix: '-redis',
  },
  postgres16: {
    image: 'postgres:16-alpine',
    port: 5432,
    env: {
      POSTGRES_PASSWORD: 'changeme',
      POSTGRES_USER: 'appuser',
      POSTGRES_DB: 'appdb',
    },
    volumes: [{ name: 'pg-data', mountPath: '/var/lib/postgresql/data', size: '10Gi' }],
    suffix: '-postgres',
  },
  postgres15: {
    image: 'postgres:15-alpine',
    port: 5432,
    env: {
      POSTGRES_PASSWORD: 'changeme',
      POSTGRES_USER: 'appuser',
      POSTGRES_DB: 'appdb',
    },
    volumes: [{ name: 'pg-data', mountPath: '/var/lib/postgresql/data', size: '10Gi' }],
    suffix: '-postgres',
  },
  mariadb: {
    image: 'mariadb:11.4',
    port: 3306,
    env: {
      MARIADB_ROOT_PASSWORD: 'changeme',
      MARIADB_DATABASE: 'appdb',
      MARIADB_USER: 'appuser',
      MARIADB_PASSWORD: 'changeme',
    },
    volumes: [{ name: 'db-data', mountPath: '/var/lib/mysql', size: '10Gi' }],
    suffix: '-mariadb',
  },
  mysql8: {
    image: 'mysql:8.0',
    port: 3306,
    env: {
      MYSQL_ROOT_PASSWORD: 'changeme',
      MYSQL_DATABASE: 'appdb',
      MYSQL_USER: 'appuser',
      MYSQL_PASSWORD: 'changeme',
    },
    volumes: [{ name: 'db-data', mountPath: '/var/lib/mysql', size: '10Gi' }],
    suffix: '-mysql',
  },
  elasticsearch8: {
    image: 'elasticsearch:8.15.0',
    port: 9200,
    env: { discovery_type: 'single-node', xpack_security_enabled: 'false' },
    volumes: [{ name: 'es-data', mountPath: '/usr/share/elasticsearch/data', size: '20Gi' }],
    suffix: '-elasticsearch',
  },
  minio: {
    image: 'minio/minio:latest',
    port: 9000,
    env: { MINIO_ROOT_USER: 'minio', MINIO_ROOT_PASSWORD: 'changeme' },
    volumes: [{ name: 'minio-data', mountPath: '/data', size: '50Gi' }],
    suffix: '-minio',
  },
  typesense: {
    image: 'typesense/typesense:27.0',
    port: 8108,
    env: { TYPESENSE_DATA_DIR: '/data', TYPESENSE_API_KEY: 'changeme' },
    volumes: [{ name: 'typesense-data', mountPath: '/data', size: '5Gi' }],
    suffix: '-typesense',
  },
};

export interface HarbrTemplate {
  name: string;
  description: string;
  category: string;
  image?: string;
  port?: number;
  env?: Record<string, string>;
  volumes?: Array<{ name: string; mountPath: string; size: string }>;
  resources?: { cpu?: string; memory?: string };
  healthcheck?: { path?: string; port?: number };
  healthcheck_path?: string;
  tags?: string[];
  deploy_mode?: 'standalone' | 'stack';
  stack_services?: string[];
  runtime_version?: string;
}

@Injectable()
export class TemplatesService {
  private templatesDir = path.join(process.cwd(), '..', 'templates');

  constructor(
    @Inject('PG_POOL') private pool: Pool,
    private projectsService: ProjectsService,
    private buildsService: BuildsService,
  ) {}

  async findAll(): Promise<Array<{ name: string; parsed: HarbrTemplate }>> {
    const files = await fs.readdir(this.templatesDir);
    const templates: Array<{ name: string; parsed: HarbrTemplate }> = [];
    for (const file of files) {
      if (!file.endsWith('.yaml') || file.startsWith('_')) continue;
      try {
        const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
        const parsed = yaml.load(content) as HarbrTemplate;
        templates.push({ name: file.replace('.yaml', ''), parsed });
      } catch {}
    }
    return templates;
  }

  async findByName(name: string): Promise<{ name: string; parsed: HarbrTemplate }> {
    const filePath = path.join(this.templatesDir, `${name}.yaml`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.load(content) as HarbrTemplate;
      return { name, parsed };
    } catch {
      throw new NotFoundException(`Template "${name}" not found`);
    }
  }

  async deployFromTemplate(
    templateName: string,
    config: {
      name: string;
      domain?: string;
      nodeSelector?: string;
      env?: Record<string, string>;
    },
    userId?: string,
  ): Promise<{ primary: any; stack_services: any[] }> {
    const { parsed: template } = await this.findByName(templateName);

    const projectName = config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const stackProjects: any[] = [];

    // ── Deploy stack sidecar services first ───────────────────────────────────
    if (template.deploy_mode === 'stack' && template.stack_services?.length) {
      for (const svcKey of template.stack_services) {
        const svcDef = STACK_COMPONENTS[svcKey];
        if (!svcDef) {
          console.warn(`[Templates] Unknown stack component: ${svcKey}, skipping`);
          continue;
        }

        const svcName = `${projectName}${svcDef.suffix}`;
        const svcProject = await this.projectsService.create({
          name: svcName,
          namespace: svcName,
          docker_image: svcDef.image,
          port: svcDef.port,
          env_vars: svcDef.env ?? {},
          cpu_request: '0.1',
          memory_request: '128Mi',
          volumes: svcDef.volumes ?? [],
          desired_status: 'running',
          created_by: userId,
          // No domain for stack sidecar services (internal only)
          domain: undefined,
        });
        await this.projectsService.update(svcProject.id, {
          current_image_tag: 'latest',
          desired_status: 'running',
        });
        stackProjects.push(svcProject);
      }
    }

    // ── Build primary project env with sidecar service hostnames ─────────────
    // Inject auto-discovered hostnames so the primary service can find sidecars
    const stackEnv: Record<string, string> = {};
    for (const svc of stackProjects) {
      // K8s ClusterIP service DNS: <service-name>.<namespace>.svc.cluster.local
      const suffix = svc.name.split('-').pop(); // postgres, redis, mysql, etc.
      stackEnv[`${suffix.toUpperCase()}_HOST`] = `${svc.name}.${svc.name}.svc.cluster.local`;
      stackEnv[`${suffix.toUpperCase()}_PORT`] = String(
        STACK_COMPONENTS[template.stack_services?.find(k => STACK_COMPONENTS[k]?.suffix?.includes(suffix)) ?? '']?.port ?? 5432
      );
    }

    // ── Deploy primary service ────────────────────────────────────────────────
    const primary = await this.projectsService.create({
      name: projectName,
      namespace: projectName,
      docker_image: template.image ?? template.runtime_version,
      port: template.port ?? 80,
      domain: config.domain,
      env_vars: { ...template.env, ...stackEnv, ...config.env },
      cpu_request: template.resources?.cpu ?? '0.1',
      memory_request: template.resources?.memory ?? '128Mi',
      healthcheck_path: template.healthcheck?.path ?? template.healthcheck_path ?? '/',
      healthcheck_port: template.healthcheck?.port ?? template.port ?? 80,
      desired_status: 'running',
      created_by: userId,
    });

    await this.projectsService.update(primary.id, { current_image_tag: 'latest', desired_status: 'running' });

    // ── Record template deployment in audit log ───────────────────────────────
    await this.pool.query(
      `INSERT INTO audit_log (action, resource_type, resource_id, actor_id, metadata)
       VALUES ('template.deploy', 'project', $1, $2, $3)`,
      [primary.id, userId ?? 'system', JSON.stringify({ template: templateName, stack_services: stackProjects.map(s => s.id) })],
    );

    return { primary, stack_services: stackProjects };
  }
}
