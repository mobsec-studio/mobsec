/**
 * Strategy registration. Order here is the default apply order for
 * Auto-Pwn: defeat anti-Frida/anti-debug first (keep the session alive),
 * then root/emulator, then pinning, then UX gates.
 */

import { registerStrategy } from '../core/registry'
import { fridaDetectionStrategy } from './frida-detection'
import { debuggerDetectionStrategy } from './debugger-detection'
import { rootDetectionStrategy } from './root-detection'
import { emulatorDetectionStrategy } from './emulator-detection'
import { sslPinningStrategy } from './ssl-pinning'
import { flutterTlsStrategy } from './flutter-tls'
import { biometricStrategy } from './biometric'
import { screenshotStrategy } from './screenshot'

export function registerAllStrategies(): void {
  registerStrategy(fridaDetectionStrategy)
  registerStrategy(debuggerDetectionStrategy)
  registerStrategy(rootDetectionStrategy)
  registerStrategy(emulatorDetectionStrategy)
  registerStrategy(sslPinningStrategy)
  registerStrategy(flutterTlsStrategy)
  registerStrategy(biometricStrategy)
  registerStrategy(screenshotStrategy)
}
