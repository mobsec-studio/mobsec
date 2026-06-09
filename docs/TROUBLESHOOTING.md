# Troubleshooting

## ADB Device Is Unauthorized

1. Disconnect and reconnect the device.
2. Accept the RSA prompt on the Android device.
3. Run `adb kill-server` and `adb start-server`.
4. Refresh devices in MobSec Studio.

## Wireless ADB Fails To Connect

- Confirm the phone and computer are on the same network.
- Confirm Wireless debugging is enabled.
- Use the pairing port for pairing and the connect port for connecting; Android
  shows different ports for these steps.
- Try USB-to-TCP/IP promotion from the Devices section when pairing is unstable.

## Frida Fails To Start

- Confirm the active device is online.
- Confirm the device is rooted or root-capable.
- Confirm the device ABI is supported.
- Reinstall the Frida tool from Settings.
- Check device logs for SELinux, permission, or mount restrictions.

## Proxy Captures No Traffic

- Confirm the Android proxy settings point to the MobSec proxy host and port.
- Install or reinstall the MobSec CA when HTTPS interception is needed.
- Some apps use certificate pinning; use Frida bypasses only with authorization.
- Some apps use native stacks or direct sockets that bypass system proxy
  settings.

## JADX Reports Errors

JADX can finish with partial errors on obfuscated or difficult APKs. Inspect the
generated project anyway; useful files are often still available.

## Linux App Does Not Launch

- Run the installer script next to the matching Linux tarball.
- Confirm `~/.local/bin` is on `PATH`, or run `~/.local/bin/mobsec-studio`.
- On some distributions, Electron sandbox setup may require package-specific
  permissions or running with the packaged wrapper.
