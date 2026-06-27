import { Controller, Post, Get, Param, Body, Headers, HttpCode, NotFoundException, BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { BuildsService } from '../builds/builds.service';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhooks: WebhooksService,
    private builds: BuildsService,
  ) {}

  @Post('receive/:endpointPath')
  @HttpCode(200)
  async receiveWebhook(
    @Param('endpointPath') endpointPath: string,
    @Headers('x-hub-signature-256') githubSig: string,
    @Headers('x-gitlab-token') gitlabToken: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
  ) {
    const webhook = await this.webhooks.findByPath(endpointPath);
    if (!webhook?.enabled) throw new NotFoundException('Webhook not found or disabled');

    // Idempotency — deduplicate GitHub deliveries
    if (deliveryId) {
      const duplicate = await this.webhooks.isDeliveryProcessed(deliveryId, webhook.id);
      if (duplicate) return { status: 'ignored', reason: 'duplicate delivery', deliveryId };
      await this.webhooks.recordDelivery(deliveryId, webhook.id);
    }

    // Verify signature (GitHub HMAC-SHA256 or GitLab token)
    const rawBody = Buffer.from(JSON.stringify(payload));
    if (githubSig) {
      await this.webhooks.verifyGitHubSignature(rawBody, githubSig, webhook.secret_hash);
    } else if (gitlabToken) {
      if (gitlabToken !== webhook.secret_hash) {
        throw new BadRequestException('Invalid GitLab token');
      }
    }

    // Parse branch from ref
    const branch = (payload?.ref ?? '').replace('refs/heads/', '');
    const rules = webhook.branch_rules ?? {};
    const rule = rules[branch] ?? rules['*'];
    if (!rule) return { status: 'ignored', reason: `no rule for branch: ${branch}` };

    // Only handle push events
    const eventType = payload?.object_kind ?? 'push';
    if (!['push', 'Push Hook'].includes(eventType) && !payload?.commits) {
      return { status: 'ignored', reason: 'not a push event' };
    }

    // Trigger build
    try {
      const build = await this.builds.triggerBuild(
        webhook.project_id,
        'webhook',
        undefined,
        deliveryId,
      );
      await this.webhooks.updateLastTriggered(webhook.id, 'triggered');
      return { status: 'triggered', branch, buildId: build.id };
    } catch (err: any) {
      await this.webhooks.updateLastTriggered(webhook.id, 'failed');
      throw err;
    }
  }

  @Get('project/:projectId')
  async findByProject(@Param('projectId') projectId: string) {
    return this.webhooks.findByProject(projectId);
  }

  @Post()
  async create(@Body() body: any) {
    // Auto-generate a random endpoint path and secret
    const endpointPath = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    return this.webhooks.create({
      ...body,
      endpoint_path: endpointPath,
      secret_hash: secretHash,
      branch_rules: body.branch_rules ?? { main: { action: 'deploy' } },
    });
  }
}
