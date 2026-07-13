(async () => {
  const https = require('node:https');
  const { HomebridgePluginUiServer } = await import('@homebridge/plugin-ui-utils');

  const requestJson = (path, token) => new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.nature.global',
      path: `/1${path}`,
      method: 'GET',
      timeout: 15000,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', Connection: 'close' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(response.statusCode === 401 ? 'アクセストークンが無効です。' : `Nature API エラー (${response.statusCode})`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Nature APIの応答を読み取れませんでした。')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Nature APIへの接続がタイムアウトしました。')));
    request.on('error', reject);
    request.end();
  });

  class NatureRemoMultiUiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      this.discovery = { status: 'idle' };
      this.onRequest('/discover/start', this.startDiscovery.bind(this));
      this.onRequest('/discover/status', this.discoveryStatus.bind(this));
      this.ready();
    }

    async startDiscovery({ accessToken }) {
      if (!accessToken || typeof accessToken !== 'string') {
        return { status: 'error', message: 'アクセストークンを入力してください。' };
      }
      if (this.discovery.status === 'running') return this.discovery;
      this.discovery = { status: 'running', startedAt: Date.now() };
      console.log('Nature Remo UI discovery started.');
      setTimeout(() => void this.performDiscovery(accessToken.trim()), 250);
      return this.discovery;
    }

    discoveryStatus() {
      return this.discovery;
    }

    async performDiscovery(accessToken) {
      try {
        const [devices, appliances] = await Promise.all([
          requestJson('/devices', accessToken.trim()),
          requestJson('/appliances', accessToken.trim()),
        ]);
        this.discovery = {
          status: 'complete',
          devices: devices.map((device) => ({
            id: device.id,
            name: device.name,
            firmware: device.firmware_version,
            serialNumber: device.serial_number,
            sensors: Object.keys(device.newest_events || {}),
            appliances: appliances
              .filter((appliance) => appliance.device?.id === device.id)
              .map((appliance) => ({ id: appliance.id, name: appliance.nickname, type: appliance.type })),
          })),
          completedAt: Date.now(),
        };
        console.log(`Nature Remo UI discovery completed: ${this.discovery.devices.length} devices.`);
      } catch (error) {
        this.discovery = {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
          completedAt: Date.now(),
        };
        console.error(`Nature Remo UI discovery failed: ${this.discovery.message}`);
      }
    }
  }

  new NatureRemoMultiUiServer();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
