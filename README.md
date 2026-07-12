# Homebridge Nature Remo Multi Platform

An independent Homebridge dynamic-platform plugin for Nature Remo. It supports multiple Remo
devices registered to one Nature account and exposes their sensors and appliances separately.

This is an unofficial community plugin and is not affiliated with Nature Inc.

## Features

- Automatic discovery of every Nature Remo on the account
- Optional filtering by Nature Remo device ID
- Alexa-style include/exclude selection for individual appliances
- Temperature, humidity and illuminance sensors
- Light on/off control
- Air-conditioner power, heating/cooling mode and target-temperature control
- TV power, mute, volume and remote-key control
- Safe API timeout and HomeKit error handling
- Automatic refresh and cleanup of Homebridge cached accessories

## Requirements

- Homebridge 1.3.5 or later
- Node.js 14.18.1 or later
- A Nature Cloud API access token from <https://home.nature.global/>

## Installation

```sh
npm install -g homebridge-nature-remo-multi-platform
```

Restart Homebridge after installation.

## Configuration

Open the plugin settings in Homebridge UI, enter the Nature access token, and select
**Connect and discover devices**. The guided screen lists every Remo together with its sensors
and associated appliances, and lets you select the Remo units and appliance types to expose.

Manual JSON configuration is also supported:

Add one platform entry in the Homebridge configuration:

```json
{
  "platform": "NatureRemoMultiPlatform",
  "name": "Nature Remo Multi",
  "accessToken": "YOUR_NATURE_ACCESS_TOKEN",
  "LIGHT": true,
  "AC": true,
  "TV": true
}
```

All Nature Remo devices are enabled when `deviceIds` is omitted. To expose only selected units:

An empty `deviceIds` array is also treated as all devices. This prevents a newly saved UI
configuration from accidentally disabling every accessory before the first discovery.

```json
{
  "platform": "NatureRemoMultiPlatform",
  "name": "Nature Remo Multi",
  "accessToken": "YOUR_NATURE_ACCESS_TOKEN",
  "deviceIds": [
    "NATURE_REMO_DEVICE_ID_1",
    "NATURE_REMO_DEVICE_ID_2"
  ],
  "LIGHT": true,
  "AC": true,
  "TV": true
}
```

Do not run the original `NatureRemoPlatformPlugin` entry and this plugin against the same
appliances at the same time. Remove or disable the old platform entry before enabling this one.

## Supported appliances

Air-conditioner modes currently exposed to HomeKit are heating and cooling. Nature Remo devices
without supported sensor readings are skipped. Appliances remain associated with the Remo unit
reported by the Nature Cloud API.

## License

Apache-2.0. This project is derived from the Apache-2.0 licensed
`homebridge-nature-remo-platform` project and retains its license and notices.

## Reliability notes

When an air conditioner is off, some Nature appliance profiles report target temperature `0`.
The plugin treats that value as unavailable and keeps the last valid HomeKit target temperature.

Device discovery runs as a background job with UI status polling. A slow or unreachable Nature
API therefore returns a visible timeout instead of leaving the Homebridge settings button locked.
