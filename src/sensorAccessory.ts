import { APIEvent, CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { NatureRemoPlatform } from './platform.js';
import { Device } from './types.js';

interface SensorSelection {
  deviceId: string;
  temperature?: boolean;
  humidity?: boolean;
  illuminance?: boolean;
  motion?: boolean;
}

export class NatureNemoSensorAccessory {
  private readonly temperatureService?: Service;
  private readonly humidityService?: Service;
  private readonly lightService?: Service;
  private readonly motionService?: Service;
  private readonly name: string;
  private readonly id: string;
  private readonly motionHoldMs: number;
  private readonly updateTimer: NodeJS.Timeout;
  private lastTemperature?: number;
  private lastHumidity?: number;
  private lastLight?: number;
  private lastMotion?: boolean;

  constructor(private readonly platform: NatureRemoPlatform, private readonly accessory: PlatformAccessory) {
    const device = this.accessory.context.device as Device;
    this.name = device.name;
    this.id = device.id;
    const settings = Array.isArray(this.platform.config.sensorSettings)
      ? (this.platform.config.sensorSettings as SensorSelection[]).find(item => item.deviceId === this.id)
      : undefined;
    const enabled = (key: keyof Omit<SensorSelection, 'deviceId'>): boolean => settings?.[key] !== false;
    this.motionHoldMs = this.seconds(this.platform.config.motionHoldSeconds, 60, 15, 600) * 1000;
    this.accessory.category = this.platform.api.hap.Categories.SENSOR;

    const [model, version] = device.firmware_version.split('/');
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Nature')
      .setCharacteristic(this.platform.Characteristic.Model, model || '')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.serial_number)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, version || '')
      .setCharacteristic(this.platform.Characteristic.Name, this.name);

    if (device.newest_events.te && enabled('temperature')) {
      this.temperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor)
        || this.accessory.addService(this.platform.Service.TemperatureSensor);
      this.temperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature).onGet(this.getTemperature.bind(this));
    } else {
      this.removeService(this.platform.Service.TemperatureSensor);
    }
    if (device.newest_events.hu && enabled('humidity')) {
      this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor)
        || this.accessory.addService(this.platform.Service.HumiditySensor);
      this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).onGet(this.getHumidity.bind(this));
    } else {
      this.removeService(this.platform.Service.HumiditySensor);
    }
    if (device.newest_events.il && enabled('illuminance')) {
      this.lightService = this.accessory.getService(this.platform.Service.LightSensor)
        || this.accessory.addService(this.platform.Service.LightSensor);
      this.lightService.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel).onGet(this.getLight.bind(this));
    } else {
      this.removeService(this.platform.Service.LightSensor);
    }
    if (device.newest_events.mo && enabled('motion')) {
      this.motionService = this.accessory.getService(this.platform.Service.MotionSensor)
        || this.accessory.addService(this.platform.Service.MotionSensor);
      this.motionService.getCharacteristic(this.platform.Characteristic.MotionDetected).onGet(this.getMotion.bind(this));
    } else {
      this.removeService(this.platform.Service.MotionSensor);
    }

    const interval = this.seconds(this.platform.config.sensorPollingSeconds, 30, 15, 300) * 1000;
    this.updateTimer = setInterval(() => void this.update(), interval);
    this.platform.api.on(APIEvent.SHUTDOWN, () => clearInterval(this.updateTimer));
    this.platform.logger.debug('[%s] sensor id -> %s, polling=%ss', this.name, this.id, interval / 1000);
  }

  private removeService(type: Parameters<PlatformAccessory['getService']>[0]): void {
    const service = this.accessory.getService(type);
    if (service) {
      this.accessory.removeService(service);
    }
  }

  private validTemperature(value: number): boolean {
    return Number.isFinite(value) && value >= -100 && value <= 100;
  }

  private validHumidity(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 100;
  }

  private validLight(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  private seconds(value: unknown, fallback: number, minimum: number, maximum: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
  }

  private light(value: number): number {
    return Math.min(100000, Math.max(0.0001, value));
  }

  private motion(device: Device): boolean {
    const created = Date.parse(device.newest_events.mo?.created_at || '');
    const age = Date.now() - created;
    return Number.isFinite(created) && age >= -5000 && age <= this.motionHoldMs;
  }

  private async update(): Promise<void> {
    try {
      const device = await this.platform.natureRemoApi.getDevice(this.id);
      const temperature = device.newest_events.te?.val;
      if (temperature !== undefined && this.validTemperature(temperature) && temperature !== this.lastTemperature) {
        this.lastTemperature = temperature;
        this.temperatureService?.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, temperature);
      }
      const humidity = device.newest_events.hu?.val;
      if (humidity !== undefined && this.validHumidity(humidity) && humidity !== this.lastHumidity) {
        this.lastHumidity = humidity;
        this.humidityService?.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
      }
      if (device.newest_events.il && this.validLight(device.newest_events.il.val)) {
        const light = this.light(device.newest_events.il.val);
        if (light !== this.lastLight) {
          this.lastLight = light; this.lightService?.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, light);
        }
      }
      if (device.newest_events.mo) {
        const motion = this.motion(device);
        if (motion !== this.lastMotion) {
          this.lastMotion = motion; this.motionService?.updateCharacteristic(this.platform.Characteristic.MotionDetected, motion);
        }
      }
    } catch (error) {
      this.platform.logger.warn('[%s] Could not update sensors: %s', this.name, error instanceof Error ? error.message : String(error));
    }
  }

  async getTemperature(): Promise<CharacteristicValue> {
    const value = (await this.platform.natureRemoApi.getDevice(this.id)).newest_events.te?.val;
    if (value === undefined || !this.validTemperature(value)) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return value;
  }

  async getHumidity(): Promise<CharacteristicValue> {
    const value = (await this.platform.natureRemoApi.getDevice(this.id)).newest_events.hu?.val;
    if (value === undefined || !this.validHumidity(value)) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return value;
  }

  async getLight(): Promise<CharacteristicValue> {
    const value = (await this.platform.natureRemoApi.getDevice(this.id)).newest_events.il?.val;
    if (value === undefined || !this.validLight(value)) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return this.light(value);
  }

  async getMotion(): Promise<CharacteristicValue> {
    return this.motion(await this.platform.natureRemoApi.getDevice(this.id));
  }
}
