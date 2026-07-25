# Changelog

## 2.0.0-rc.1

- Migrate the plugin runtime to native ESM for Homebridge 2.x.
- Require Homebridge 2.x and Node.js 22.13 or 24.
- Update Axios and other runtime dependencies; production dependency audit is clean.
- Compile and type-check against Homebridge 2.2.
- Add API cache, command, response-validation and error-mapping tests.
- Validate Nature API collection responses before accessory discovery.
- Limit API response sizes in the platform and custom UI.
- Clamp manually configured sensor intervals to their documented ranges.
- Reject invalid illuminance and air-conditioner temperature readings.
- Handle future-dated motion events safely.
- Correct Remo-selection guidance in the Japanese and English UI.
- Modernize the GitHub Actions Node.js test matrix.

## 1.4.4

- Keep UI discovery results in memory instead of writing device metadata to disk.
- Poll the UI server through short status requests.
- Stop sensor polling timers during Homebridge shutdown.
- Correct English requirements and Remo-selection documentation.

## 1.4.3

- Fix configuration initialization and accessory lifecycle handling.
- Improve air-conditioner state synchronization and startup error handling.

## 1.4.2

- Add the Japanese README.

## 1.4.1

- Initial independent release.
