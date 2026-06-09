/**
 * Detector registration. Called once at agent startup. Adding a new
 * reconnaissance plugin is a one-line change here plus the detector file.
 */

import { registerDetector } from '../core/registry'
import { frameworkDetector } from './framework'
import { networkingDetector } from './networking'
import { cryptoDetector } from './crypto'
import { storageDetector } from './storage'
import { securityDetector } from './security'

export function registerAllDetectors(): void {
  registerDetector(frameworkDetector)
  registerDetector(networkingDetector)
  registerDetector(cryptoDetector)
  registerDetector(storageDetector)
  registerDetector(securityDetector)
}
