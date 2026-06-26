import { Injectable, ForbiddenException } from '@nestjs/common';
import { lookup } from 'dns/promises';

@Injectable()
export class ExternalProxyService {
  private readonly BLOCKED_PORTS = new Set([
    22, 2379, 2380, 5000, 6379, 6443,
    7700, 8080, 9090, 9093, 9100, 19999, 30500,
  ]);

  private readonly BLOCKED_CIDRS = [
    { cidr: '10.42.0.0/16', name: 'K3s pod network' },
    { cidr: '10.43.0.0/16', name: 'K3s service network' },
    { cidr: '100.64.0.0/10', name: 'Tailscale network' },
    { cidr: '172.16.0.0/12', name: 'Docker internal network' },
  ];

  async validateProxyTarget(address: string, port: number): Promise<void> {
    if (this.BLOCKED_PORTS.has(port)) {
      throw new ForbiddenException(`Port ${port} is blocked for security`);
    }
    if (address !== 'localhost' && address !== '127.0.0.1') {
      try {
        const resolved = await lookup(address);
        for (const { cidr, name } of this.BLOCKED_CIDRS) {
          if (this.ipInCidr(resolved.address, cidr)) {
            throw new ForbiddenException(
              `Target ${address} is in restricted network: ${name} (${cidr})`,
            );
          }
        }
      } catch {}
    }
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    const [net, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    const ipNum = this.ipToInt(ip);
    const netNum = this.ipToInt(net);
    return (ipNum & mask) === (netNum & mask);
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
  }
}
