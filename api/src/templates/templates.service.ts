import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BuildsService } from '../builds/builds.service';
import { ProjectsService } from '../projects/projects.service';

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
  tags?: string[];
}

@Injectable()
export class TemplatesService {
  private templatesDir = path.join(process.cwd(), '..', 'templates');

  constructor(
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
    config: { name: string; domain?: string; nodeSelector?: string; env?: Record<string, string> },
    userId?: string,
  ): Promise<any> {
    const { name: tName, parsed: template } = await this.findByName(templateName);

    // Create the project
    const project = await this.projectsService.create({
      name: config.name,
      namespace: config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      docker_image: template.image,
      port: template.port ?? 80,
      domain: config.domain,
      env_vars: { ...template.env, ...config.env },
      cpu_request: template.resources?.cpu ?? '0.1',
      memory_request: template.resources?.memory ?? '128Mi',
      healthcheck_path: template.healthcheck?.path ?? '/',
      healthcheck_port: template.healthcheck?.port ?? template.port ?? 80,
      created_by: userId,
    });

    // If the template has an image (not a build), enqueue a deploy directly.
    // If there's a git_url it should trigger a build via triggerBuild.
    if (template.image) {
      // For pre-built images, update project to deploying and enqueue deploy job
      await this.projectsService.update(project.id, { current_image_tag: 'latest' });
      // A build record is not needed for images, so we enqueue a deploy directly
      const { JobsService } = await import('../jobs/jobs.service');
      // We can't inject JobsService here due to circular dep, so just mark deploying
      // The reconciler will pick it up based on desired_status.
      await this.projectsService.update(project.id, { desired_status: 'running' });
    }

    return project;
  }
}
