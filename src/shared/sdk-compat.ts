import type { SdkSetupOptions } from './types'

export type EmulatorAbi = SdkSetupOptions['abi']

export function getRecommendedEmulatorAbi(platform: string, arch: string): EmulatorAbi {
  return arch === 'arm64' && (platform === 'darwin' || platform === 'linux')
    ? 'arm64-v8a'
    : 'x86_64'
}

export function isEmulatorAbiCompatible(
  abi: string | null | undefined,
  platform: string,
  arch: string
): boolean {
  if (!abi) return true
  return normalizeEmulatorAbi(abi) === getRecommendedEmulatorAbi(platform, arch)
}

export function normalizeEmulatorAbi(abi: string): EmulatorAbi | string {
  const lower = abi.toLowerCase()
  if (lower === 'arm64' || lower === 'aarch64') return 'arm64-v8a'
  if (lower === 'x86-64' || lower === 'amd64') return 'x86_64'
  return lower
}

export function describeHostForEmulator(platform: string, arch: string): string {
  const os =
    platform === 'win32'
      ? 'Windows'
      : platform === 'darwin'
        ? 'macOS'
        : platform === 'linux'
          ? 'Linux'
          : platform
  return `${os} ${arch}`
}

export function incompatibleAbiMessage(abi: string, platform: string, arch: string): string {
  const recommended = getRecommendedEmulatorAbi(platform, arch)
  return `This AVD uses ${abi}, but ${describeHostForEmulator(
    platform,
    arch
  )} requires a ${recommended} system image. Re-run Settings > Android SDK > Quick setup to recreate the AVD with ${recommended}.`
}
