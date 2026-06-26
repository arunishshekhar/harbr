import { Test, TestingModule } from '@nestjs/testing';
import { BuildsService } from './builds.service';

describe('BuildsService', () => {
  let service: BuildsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildsService,
        { provide: 'PG_POOL', useValue: { query: jest.fn().mockResolvedValue({ rows: [] }) } },
        { provide: 'BullQueue_harbr-jobs', useValue: { add: jest.fn() } },
      ],
    }).compile();
    service = module.get<BuildsService>(BuildsService);
  });

  it('triggerBuild sets project_status to building', async () => {
    const pool = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'proj-1', git_branch: 'main', port: 3000,
        project_status: 'idle' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'build-1' }] })};
    const queue = { add: jest.fn() };
    (service as any).pool = pool;
    (service as any).queue = queue;
    const result = await service.triggerBuild('proj-1');
    expect(result.id).toBe('build-1');
    expect(queue.add).toHaveBeenCalled();
  });

  it('triggerBuild rejects if active build exists', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await expect(service.triggerBuild('proj-1')).rejects.toThrow('active build');
  });
});
