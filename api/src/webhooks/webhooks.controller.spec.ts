import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { BuildsService } from '../builds/builds.service';

const mockPool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhooksService,
        BuildsService,
        { provide: 'PG_POOL', useValue: mockPool },
        { provide: 'BullQueue_harbr-jobs', useValue: mockQueue },
      ],
    }).compile();
    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);
  });

  it('ignores duplicate X-GitHub-Delivery ID', async () => {
    jest.spyOn(service, 'findByPath').mockResolvedValue({
      id: 'wh-1', enabled: true, project_id: 'proj-1',
      branch_rules: { main: { action: 'deploy' } }, secret_hash: '',
    });
    jest.spyOn(service, 'isDeliveryProcessed').mockResolvedValue(true);
    const result = await controller.receiveWebhook(
      'test-path', '', '', 'dup-delivery-id',
      { ref: 'refs/heads/main' },
    );
    expect(result.status).toBe('ignored');
    expect(result.reason).toContain('duplicate');
  });

  it('ignores non-push events', async () => {
    jest.spyOn(service, 'findByPath').mockResolvedValue({
      id: 'wh-1', enabled: true, project_id: 'proj-1',
      branch_rules: { main: { action: 'deploy' } }, secret_hash: '',
    });
    jest.spyOn(service, 'isDeliveryProcessed').mockResolvedValue(false);
    jest.spyOn(service, 'recordDelivery').mockResolvedValue(undefined);
    const result = await controller.receiveWebhook(
      'test-path', '', '', 'some-delivery',
      { ref: 'refs/heads/main', object_kind: 'merge_request' },
    );
    expect(result.status).toBe('ignored');
  });
});
