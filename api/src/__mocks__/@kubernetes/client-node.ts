export class KubeConfig {
  loadFromCluster() {}
  loadFromDefault() {}
  getCurrentCluster() { return { server: 'https://localhost:6443', name: 'test' }; }
}

export class KubernetesObjectApi {
  static makeApiClient(_kc: KubeConfig) { return new KubernetesObjectApi(); }
  create(_spec: any) { return Promise.resolve({}); }
  read(_spec: any) { return Promise.resolve({}); }
  replace(_spec: any) { return Promise.resolve({}); }
  delete(_spec: any) { return Promise.resolve({}); }
  list(..._args: any[]) { return Promise.resolve({ items: [] }); }
}

export class Log {
  constructor(_config: KubeConfig) {}
  log(_namespace: string, _podName: string, _containerName: string, _stream: any, _options?: any) {
    return Promise.resolve({ abort: () => {} });
  }
}
