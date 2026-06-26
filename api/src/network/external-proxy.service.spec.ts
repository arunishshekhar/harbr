import { ExternalProxyService } from './external-proxy.service';

describe('ExternalProxyService', () => {
  let service: ExternalProxyService;

  beforeEach(() => {
    service = new ExternalProxyService();
  });

  it('blocks port 6443', async () => {
    await expect(service.validateProxyTarget('localhost', 6443)).rejects.toThrow('blocked');
  });

  it('blocks port 22', async () => {
    await expect(service.validateProxyTarget('localhost', 22)).rejects.toThrow('blocked');
  });

  it('blocks port 6379', async () => {
    await expect(service.validateProxyTarget('localhost', 6379)).rejects.toThrow('blocked');
  });

  it('allows localhost:11434', async () => {
    await expect(service.validateProxyTarget('localhost', 11434)).resolves.toBeUndefined();
  });

  it('allows localhost:8080', async () => {
    await expect(service.validateProxyTarget('localhost', 8080)).resolves.toBeUndefined();
  });

  it('blocks localhost:6443', async () => {
    await expect(service.validateProxyTarget('localhost', 6443)).rejects.toThrow('blocked');
  });
});
