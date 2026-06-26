import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { KubeConfig, KubernetesObjectApi, Log } from '@kubernetes/client-node';
import { Writable } from 'stream';

@Injectable()
export class KanikoService {
  private k8sApi: KubernetesObjectApi;
  private logApi: Log;

  constructor(@Inject('PG_POOL') private pool: Pool) {
    const kc = new KubeConfig();
    process.env.KUBERNETES_SERVICE_HOST
      ? kc.loadFromCluster()
      : kc.loadFromDefault();
    this.k8sApi = KubernetesObjectApi.makeApiClient(kc);
    this.logApi = new Log(kc);
  }

  async executeKanikoJob(payload: any): Promise<void> {
    const {
      buildId, projectId, gitUrl, gitBranch,
      gitCredentialsSecret, gitCredentialsType,
      buildSecretsSecret, port,
    } = payload;

    await this.pool.query(
      "UPDATE projects SET project_status = 'building' WHERE id = $1",
      [projectId],
    );
    await this.pool.query(
      "UPDATE builds SET status = 'running', started_at = NOW() WHERE id = $1",
      [buildId],
    );

    const jobName = `build-${buildId.slice(0, 8)}`;
    const reg = `${process.env.REGISTRY_IP}:30500`;
    const imageTag = `${Date.now()}`;
    const cloneCmd = this.buildCloneCommand(gitUrl, gitBranch, gitCredentialsType);

    const initContainers: any[] = [{
      name: 'git-clone',
      image: 'alpine/git:2.43.0',
      command: ['/bin/sh', '-c', cloneCmd],
      volumeMounts: [{ name: 'workspace', mountPath: '/workspace' }],
    }];

    if (gitCredentialsType === 'token' && gitCredentialsSecret) {
      initContainers[0].env = [{
        name: 'GIT_TOKEN',
        valueFrom: { secretKeyRef: { name: gitCredentialsSecret, key: 'token' } },
      }];
    }

    const volumes: any[] = [
      { name: 'workspace', emptyDir: {} },
      {
        name: 'registry-creds',
        secret: {
          secretName: 'registry-credentials',
          items: [{ key: '.dockerconfigjson', path: 'config.json' }],
        },
      },
    ];

    if (gitCredentialsType === 'ssh') {
      volumes.push({
        name: 'ssh-creds',
        secret: { secretName: gitCredentialsSecret, defaultMode: 0o400 },
      });
      initContainers[0].volumeMounts.push(
        { name: 'ssh-creds', mountPath: '/root/.ssh', readOnly: true },
      );
    }

    const kanikoContainer: any = {
      name: 'kaniko',
      image: 'gcr.io/kaniko-project/executor:v1.23.2',
      args: [
        '--context=/workspace',
        '--dockerfile=/workspace/Dockerfile',
        `--destination=${reg}/${projectId}:${imageTag}`,
        `--destination=${reg}/${projectId}:latest`,
        '--insecure',
        '--cache=true',
        `--cache-repo=${reg}/cache/${projectId}`,
      ],
      volumeMounts: [
        { name: 'workspace', mountPath: '/workspace' },
        { name: 'registry-creds', mountPath: '/kaniko/.docker' },
      ],
    };

    if (buildSecretsSecret) {
      kanikoContainer.envFrom = [{ secretRef: { name: buildSecretsSecret } }];
    }

    const job: any = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace: 'harbr-builds',
        labels: { 'harbr.io/build-id': buildId },
      },
      spec: {
        ttlSecondsAfterFinished: 3600,
        backoffLimit: 1,
        template: {
          spec: {
            restartPolicy: 'Never',
            initContainers,
            containers: [kanikoContainer],
            volumes,
          },
        },
      },
    };

    await this.ensureNamespace('harbr-builds');

    try {
      await this.k8sApi.create(job);
    } catch (e: any) {
      if (e.body?.code === 409 || e.statusCode === 409) {
        await this.k8sApi.delete({ apiVersion: 'batch/v1', kind: 'Job', metadata: { name: jobName, namespace: 'harbr-builds' } });
        await this.k8sApi.create(job);
      } else {
        throw e;
      }
    }

    try {
      await this.pollJob(jobName, buildId);
      await this.pool.query(
        "UPDATE projects SET project_status = 'deploying', current_image_tag = $2 WHERE id = $1",
        [projectId, imageTag],
      );
      await this.pool.query(
        "UPDATE builds SET status = 'success', image_tag = $2, completed_at = NOW() WHERE id = $1",
        [buildId, imageTag],
      );
    } catch (err: any) {
      await this.pool.query(
        "UPDATE projects SET project_status = 'failed' WHERE id = $1",
        [projectId],
      );
      await this.pool.query(
        "UPDATE builds SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1",
        [buildId, err.message],
      );
      throw err;
    }
  }

  private async ensureNamespace(ns: string): Promise<void> {
    try {
      await this.k8sApi.read({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: ns } });
    } catch {
      try {
        await this.k8sApi.create({
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: ns, labels: { 'harbr.io/managed': 'true' } },
        });
      } catch {}
    }
  }

  private async pollJob(jobName: string, buildId: string, timeoutMs = 600000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const job = await this.k8sApi.read({ apiVersion: 'batch/v1', kind: 'Job', metadata: { name: jobName, namespace: 'harbr-builds' } }) as any;
      if (job.status?.succeeded) return;
      if (job.status?.failed) {
        const podList = await this.k8sApi.list('v1', 'Pod', 'harbr-builds', undefined, undefined, undefined, `job-name=${jobName}`) as any;
        const logs: string[] = [];
        for (const pod of podList.items || []) {
          try {
            const log = await this.getPodLog('harbr-builds', pod.metadata.name, 'kaniko');
            logs.push(log);
          } catch {}
        }
        throw new Error(`Build failed: ${logs.join('\n') || 'Unknown error'}`);
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error('Build timed out after 10 minutes');
  }

  private getPodLog(namespace: string, podName: string, containerName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new Writable({
        write(chunk: any, _encoding: string, callback: Function) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          callback();
        },
      });
      this.logApi.log(namespace, podName, containerName, stream, { tailLines: 50 })
        .then(controller => {
          stream.on('finish', () => resolve(Buffer.concat(chunks).toString('utf-8')));
          stream.on('error', reject);
          setTimeout(() => { controller.abort(); stream.end(); }, 10000);
        })
        .catch(reject);
    });
  }

  private buildCloneCommand(url: string, branch: string, credType?: string): string {
    if (credType === 'token') {
      return `git clone --depth 1 --branch ${branch} ` +
        `$(echo "${url}" | sed 's|https://|https://x-token:$GIT_TOKEN@|') /workspace`;
    }
    if (credType === 'ssh') {
      return `chmod 600 /root/.ssh/id_rsa && ` +
        `ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts 2>/dev/null && ` +
        `git clone --depth 1 --branch ${branch} ${url} /workspace`;
    }
    return `git clone --depth 1 --branch ${branch} ${url} /workspace`;
  }
}
