import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import axios from 'axios';

@Injectable()
export class CleanupService {
  constructor(@Inject('PG_POOL') private pool: Pool) {}

  @Cron('0 0 * * *')
  async maintainAuditLog() {
    await this.pool.query('SELECT create_audit_log_partition()');
    await this.pool.query('SELECT drop_old_audit_log_partitions()');
    await this.pool.query('DELETE FROM jwt_blocklist WHERE expires_at < NOW()');
    await this.pool.query('DELETE FROM webhook_deliveries WHERE expires_at < NOW()');
    console.log('[Cleanup] Audit partitions maintained, expired entries cleaned');
  }

  @Cron('0 3 * * 0')
  async cleanBuildCache() {
    console.log('[Cleanup] Weekly build cache cleanup started');

    const registryIP = process.env.REGISTRY_IP ?? 'localhost';
    const registryPort = 30500;
    const registryBase = `http://${registryIP}:${registryPort}/v2`;
    const keepTags = parseInt(process.env.REGISTRY_KEEP_TAGS ?? '5', 10);

    // Fetch all repositories in the internal registry
    let repos: string[] = [];
    try {
      const catalogRes = await axios.get(`${registryBase}/_catalog`, { timeout: 10_000 });
      repos = catalogRes.data?.repositories ?? [];
    } catch (err) {
      console.warn('[Cleanup] Registry not reachable — skipping build cache cleanup', err);
      return;
    }

    let deletedCount = 0;
    for (const repo of repos) {
      try {
        // Get list of tags sorted by creation order (oldest first)
        const tagsRes = await axios.get(`${registryBase}/${repo}/tags/list`, { timeout: 5_000 });
        const tags: string[] = tagsRes.data?.tags ?? [];

        if (tags.length <= keepTags) continue;

        // Tags older than keepTags — delete their manifests
        const toDelete = tags.slice(0, tags.length - keepTags);
        for (const tag of toDelete) {
          try {
            // Resolve digest
            const manifestRes = await axios.get(
              `${registryBase}/${repo}/manifests/${tag}`,
              {
                timeout: 5_000,
                headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' },
              },
            );
            const digest = manifestRes.headers['docker-content-digest'];
            if (!digest) continue;

            // Delete by digest
            await axios.delete(`${registryBase}/${repo}/manifests/${digest}`, { timeout: 5_000 });
            deletedCount++;
            console.log(`[Cleanup] Deleted ${repo}:${tag} (${digest})`);
          } catch (err) {
            console.warn(`[Cleanup] Failed to delete ${repo}:${tag}`, err);
          }
        }
      } catch (err) {
        console.warn(`[Cleanup] Failed to process repo ${repo}`, err);
      }
    }

    // Run garbage collect on the registry pod if any manifests were deleted
    if (deletedCount > 0) {
      try {
        const { exec } = await import('child_process');
        exec(
          'kubectl -n harbr-system exec deploy/registry -- /bin/registry garbage-collect /etc/docker/registry/config.yml',
          (err, stdout) => {
            if (err) console.warn('[Cleanup] GC failed:', err);
            else console.log('[Cleanup] GC output:', stdout);
          },
        );
      } catch {}
    }

    // Also clean old build records from DB (keep last 50 per project)
    await this.pool.query(`
      DELETE FROM builds
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) AS rn
          FROM builds
        ) t WHERE rn > 50
      )
    `);

    console.log(`[Cleanup] Done — deleted ${deletedCount} old image tags, trimmed build records`);
  }
}
