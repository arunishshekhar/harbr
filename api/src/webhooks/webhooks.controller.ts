import { Controller, Post, Get, Param, Body, Headers, HttpCode, NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Post('receive/:endpointPath')
  @HttpCode(200)
  async receiveWebhook(
    @Param('endpointPath') endpointPath: string,
    @Headers('x-hub-signature-256') githubSig: string,
    @Headers('x-gitlab-token') gitlabToken: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
    @Body() _rawBody: Buffer,
  ) {
    const webhook = await this.webhooks.findByPath(endpointPath);
    if (!webhook?.enabled) throw new NotFoundException();

    if (deliveryId) {
      const duplicate = await this.webhooks.isDeliveryProcessed(deliveryId, webhook.id);
      if (duplicate) return { status: 'ignored', reason: 'duplicate delivery', deliveryId };
      await this.webhooks.recordDelivery(deliveryId, webhook.id);
    }

    await this.webhooks.verifyGitHubSignature(
      Buffer.from(JSON.stringify(payload)),
      githubSig,
      webhook.secret_hash,
    );

    const branch = (payload?.ref || '').replace('refs/heads/', '');
    const rule = webhook.branch_rules?.[branch];
    if (!rule) return { status: 'ignored', reason: `no rule for branch: ${branch}` };

    const eventType = payload?.object_kind || 'push';
    if (!['push', 'Push Hook'].includes(eventType)) {
      return { status: 'ignored', reason: 'not a push event' };
    }

    return { status: 'triggered', branch, rule };
  }

  @Get('project/:projectId')
  async findByProject(@Param('projectId') projectId: string) {
    return this.webhooks.findByProject(projectId);
  }

  @Post()
  async create(@Body() body: any) { return this.webhooks.create(body); }
}
