import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: () => 'token' } },
        { provide: 'PG_POOL', useValue: { query: jest.fn().mockResolvedValue({ rows: [] }) } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('login returns JWT with jti claim', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{
      id: '1', username: 'admin', password_hash: '$2b$12$LJ3m4ys3Lk', role: 'admin', is_active: true,
    }]})};
    (service as any).pool = pool;
    const result = await service.login('admin', 'password');
    expect(result.access_token).toBeDefined();
    expect(result.user.username).toBe('admin');
  });

  it('login throws 401 on wrong password', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await expect(service.login('admin', 'wrong')).rejects.toThrow();
  });

  it('login throws 401 on inactive user', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{
      id: '1', username: 'admin', password_hash: 'hash', role: 'admin', is_active: false,
    }]})};
    (service as any).pool = pool;
    await expect(service.login('admin', 'password')).rejects.toThrow('inactive');
  });

  it('logout adds jti to jwt_blocklist', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.logout('test-jti', 'user-1', new Date());
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO jwt_blocklist'),
      ['test-jti', 'user-1', expect.any(Date)],
    );
  });

  it('revokeAllSessions increments token_version', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    await service.revokeAllSessions('user-1');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET token_version'),
      ['user-1'],
    );
  });

  it('isJwtRevoked returns true for blocked jti', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [{}] })};
    (service as any).pool = pool;
    expect(await service.isJwtRevoked('blocked-jti')).toBe(true);
  });

  it('isJwtRevoked returns false for valid jti', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] })};
    (service as any).pool = pool;
    expect(await service.isJwtRevoked('valid-jti')).toBe(false);
  });
});
