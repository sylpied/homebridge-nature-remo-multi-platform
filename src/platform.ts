import {
  API,
  APIEvent,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { NatureRemoApi } from './natureRemoApi.js';
import { NatureNemoLightAccessory } from './lightAccessory.js';
import { NatureNemoAirConAccessory } from './airConAccessory.js';
import { NatureNemoTvAccessory } from './tvAccessory.js';
import { NatureNemoSensorAccessory } from './sensorAccessory.js';
import { Device } from './types.js';

export class NatureRemoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly natureRemoApi: NatureRemoApi;

  constructor(
    public readonly logger: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.logger.debug('Nature Remo access token is %s', this.config.accessToken ? 'configured' : 'missing');
    this.natureRemoApi = new NatureRemoApi(this.logger, this.api, this.config.accessToken as string);
    this.logger.debug('Finished initializing platform:', this.config.name);

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, async () => {
      logger.debug('Executed didFinishLaunching callback');
      logger.info('Starting discover accessories');
      try {
        await this.discoverDevices();
        logger.info('Completed discover accessories');
      } catch (error) {
        logger.error('Accessory discovery failed: %s', error instanceof Error ? error.message : String(error));
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.logger.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices(): Promise<void> {
    const configuredDeviceIds = this.config.deviceFilterConfigured === true && Array.isArray(this.config.deviceIds)
      ? new Set(this.config.deviceIds as string[])
      : undefined;
    const allDevices = await this.natureRemoApi.getAllDevices();
    const devices = configuredDeviceIds
      ? allDevices.filter(device => configuredDeviceIds.has(device.id))
      : allDevices;
    const discoveredIds = new Set<string>();
    for (const device of devices) {
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === device.id);
      if (!this.hasEnabledSensors(device)) {
        if (existingAccessory) {
          this.logger.info('Sensor accessory has no enabled services and will be removed:', existingAccessory.displayName);
        }
        continue;
      }
      discoveredIds.add(device.id);
      if (existingAccessory) {
        this.logger.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);
        new NatureNemoSensorAccessory(this, existingAccessory);
      } else {
        if (Object.keys(device.newest_events).some(event => ['te', 'hu', 'il', 'mo'].includes(event))) {
          this.logger.info('Adding new accessory: %s (%s)', device.name, device.firmware_version);
          const accessory = new this.api.platformAccessory(device.name, device.id);
          accessory.context = { device: device };
          new NatureNemoSensorAccessory(this, accessory);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
          this.logger.info('%s (%s) has no sensor. skip.', device.name, device.firmware_version);
        }
      }
    }
    const allAppliances = await this.natureRemoApi.getAllAppliances();
    let appliances = configuredDeviceIds
      ? allAppliances.filter(appliance => configuredDeviceIds.has(appliance.device.id))
      : allAppliances;
    const applianceIds = new Set(Array.isArray(this.config.applianceIds) ? this.config.applianceIds as string[] : []);
    if (this.config.applianceFilterMode === 'include') {
      appliances = appliances.filter(appliance => applianceIds.has(appliance.id));
    } else if (this.config.applianceFilterMode === 'exclude') {
      appliances = appliances.filter(appliance => !applianceIds.has(appliance.id));
    }
    for (const appliance of appliances) {
      discoveredIds.add(appliance.id);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === appliance.id);
      if ((this.config.LIGHT && appliance.type === 'LIGHT')
      || (this.config.AC && appliance.type === 'AC')
      || (this.config.TV && appliance.type === 'TV')) {
        if (existingAccessory) {
          this.logger.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.appliance = appliance;
          this.api.updatePlatformAccessories([existingAccessory]);
          if (appliance.type === 'LIGHT') {
            new NatureNemoLightAccessory(this, existingAccessory);
          } else if (appliance.type === 'AC') {
            new NatureNemoAirConAccessory(this, existingAccessory);
          } else if (appliance.type === 'TV') {
            new NatureNemoTvAccessory(this, existingAccessory);
          }
        } else {
          this.logger.info('Adding new accessory:', appliance.nickname);
          const accessory = new this.api.platformAccessory(appliance.nickname, appliance.id);
          accessory.context = { appliance: appliance };
          if (appliance.type === 'LIGHT') {
            new NatureNemoLightAccessory(this, accessory);
          } else if (appliance.type === 'AC') {
            new NatureNemoAirConAccessory(this, accessory);
          } else if (appliance.type === 'TV') {
            new NatureNemoTvAccessory(this, accessory);
          }
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      } else {
        if (existingAccessory) {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        }
      }
    }

    const staleAccessories = this.accessories.filter(accessory => !discoveredIds.has(accessory.UUID));
    if (staleAccessories.length > 0) {
      this.logger.info('Removing %d stale or excluded accessories from cache', staleAccessories.length);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }
  }

  private hasEnabledSensors(device: Device): boolean {
    const settings = Array.isArray(this.config.sensorSettings)
      ? (this.config.sensorSettings as Array<Record<string, unknown>>).find(item => item.deviceId === device.id)
      : undefined;
    const mappings = [
      ['te', 'temperature'],
      ['hu', 'humidity'],
      ['il', 'illuminance'],
      ['mo', 'motion'],
    ];
    return mappings.some(([event, setting]) => event in device.newest_events && settings?.[setting] !== false);
  }
}
