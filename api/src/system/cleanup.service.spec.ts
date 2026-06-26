import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';

describe('CleanupService', () => {
  let service: CleanupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: 'PG_POOL', useValue: { query: jest.fn().mockResolvedValue({ rows: [] }) } },
      ],
    }).compile();
    service = module.get<CleanupService>(CleanupService);
  });

  it('maintainAuditLog calls create_audit_log_partition', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.maintainAuditLog();
    expect(pool.query).toHaveBeenCalledWith('SELECT create_audit_log_partition()');
  });

  it('maintainAuditLog calls drop_old_audit_log_partitions', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.maintainAuditLog();
    expect(pool.query).toHaveBeenCalledWith('SELECT drop_old_audit_log_partitions()');
  });

  it('maintainAuditLog deletes expired jwt_blocklist entries', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.maintainAuditLog();
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM jwt_blocklist WHERE expires_at < NOW()');
  });

  it('maintainAuditLog deletes expired webhook_deliveries', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.maintainAuditLog();
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM webhook_deliveries WHERE expires_at < NOW()');
  });
});
