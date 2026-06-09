# Changelog

All notable changes to MobSec Studio will be documented here.

This project follows a beta release cadence while the API, workflows, and
packaging model continue to stabilize.

## 0.1.0-beta.2 - 2026-06-10

- Rebuilt Windows and Linux release artifacts from the latest source.
- Fixed Linux installer payload layout handling.
- Improved release packaging exclusions so generated releases are not bundled
  back into future app packages.
- Added normal compression configuration for faster local packaging.

## 0.1.0-beta.1 - 2026-06-09

- Initial public beta packaging line.
- Includes APK Analyzer, JADX, Frida, Proxy, Repeater, Logcat, emulator/device
  management, Settings, and local project storage.
