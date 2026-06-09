import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'

/**
 * Cross-platform child-process spawn with safe handling of Windows batch
 * files. Node 20.12.2 / 18.20.2 banned direct `.bat`/`.cmd` spawning to fix
 * CVE-2024-27980; calling `spawn('foo.bat', ...)` now returns EINVAL. The
 * documented workaround is `shell: true`, but that defers argument escaping
 * to cmd.exe, which is happy to interpret special characters as command
 * delimiters.
 *
 * Instead we route batch scripts through `cmd.exe /d /s /c` ourselves with
 * each argument quoted per Windows cmd rules and `windowsVerbatimArguments`
 * set so Node doesn't re-escape on top of us. Non-batch binaries on Windows
 * and everything on POSIX go through the normal spawn path.
 */
export function safeSpawn(
  command: string,
  args: readonly string[] = [],
  options: SpawnOptions = {}
): ChildProcess {
  if (process.platform !== 'win32') {
    return spawn(command, args, options)
  }

  const lower = command.toLowerCase()
  const isBatch = lower.endsWith('.bat') || lower.endsWith('.cmd')
  if (!isBatch) {
    return spawn(command, args, options)
  }

  const quoted = [command, ...args].map(quoteForCmd).join(' ')
  const comSpec = process.env['ComSpec'] || 'cmd.exe'
  return spawn(comSpec, ['/d', '/s', '/c', `"${quoted}"`], {
    ...options,
    windowsVerbatimArguments: true
  })
}

/**
 * Quote a single argument for a Windows command line that will be parsed by
 * cmd.exe. We double-quote anything containing shell-significant characters
 * and escape inner double quotes by doubling them (`""`), per the cmd.exe
 * documentation. Backslashes are passed through literally.
 */
function quoteForCmd(arg: string): string {
  if (arg === '') return '""'
  if (!/[\s"&<>|^,;=()!%]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '""')}"`
}
