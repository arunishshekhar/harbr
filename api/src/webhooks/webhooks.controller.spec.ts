import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhooksService,
        { provide: 'PG_POOL', useValue: { query: jest.fn().mockResolvedValue({ rows: [] }) } },
      ],
    }).compile();
    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);
  });

  it('ignores duplicate X-GitHub-Delivery ID', async () => {
    jest.spyOn(service, 'findByPath').mockResolvedValue({ id: 'wh-1', enabled: true, branch_rules: { main: 'deploy' } });
    jest.spyOn(service, 'isDeliveryProcessed').mockResolvedValue(true);
    const result = await controller.receiveWebhook(
      'test-path', '', '', 'dup-delivery-id',
      { ref: 'refs/heads/main' }, Buffer.from(''),
    );
    expect(result.status).toBe('ignored');
    expect(result.reason).toContain('duplicate');
  });

  it('processes unique delivery IDs normally', async () => {
    jest.spyOn(service, 'findByPath').mockResolvedValue({ id: 'wh-1', enabled: true, branch_rules: { main: 'deploy' } });
    jest.spyOn(service, 'isDeliveryProcessed').mockResolvedValue(false);
    jest.spyOn(service, 'recordDelivery').mockResolvedValue(undefined);
    const result = await controller.receiveWebhook(
      'test-path', '', '', 'unique-delivery',
      { ref: 'refs/heads/main' }, Buffer.from(''),
    );
    expect(result.status).toBe('triggered');
  });

  it('ignores non-push events', async () => {
    jest.spyOn(service, 'findByPath').mockResolvedValue({ id: 'wh-1', enabled: true, branch_rules: { main: 'deploy' } });
    const result = await controller.receiveWebhook(
      'test-path', '', '', undefined,
      { ref: 'refs/heads/main', object_kind: 'merge_request' }, Buffer.from(''),
    );
    expect(result.status).toBe('ignored');
    expect(result.reason).toContain('not a push event');
  });
});
