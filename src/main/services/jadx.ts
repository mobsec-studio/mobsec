import { createHash } from 'node:crypto'
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs'
import { cpus } from 'node:os'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { shell } from 'electron'
import type {
  ApkComponentSummary,
  JadxCodeFinding,
  JadxDecompileOptions,
  JadxEntryPoint,
  JadxFileEntry,
  JadxProgress,
  JadxProjectSummary,
  JadxReadFileResult,
  JadxSearchResult,
  JadxStatus,
  SecretSeverity
} from '@shared/types'
import { apkAnalyzerService } from './apk-analyzer'
import { extractEndpoints } from './apk/endpoints'
import { scanCorpus, type CorpusEntry } from './apk/secrets'
import { toolchainService } from './toolchain'
import { bus } from '../utils/event-bus'
import { getPaths } from '../utils/paths'
import { safeSpawn } from '../utils/spawn'

interface ProjectRecord {
  summary: JadxProjectSummary
  outputDir: string
}

interface FileInfo {
  absolute: string
  relative: string
  size: number
}

interface CodeRule {
  id: string
  title: string
  severity: SecretSeverity
  detail: string
  regex: RegExp
}

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

const MAX_OUTPUT = 80_000
const MAX_SCAN_FILE_BYTES = 2 * 1024 * 1024
const MAX_READ_FILE_BYTES = 5 * 1024 * 1024
const MAX_HEX_PREVIEW_BYTES = 64 * 1024
const MAX_SCAN_FILES = 3_000

const CODE_RULES: CodeRule[] = [
  {
    id: 'webview-js',
    title: 'WebView JavaScript enabled',
    severity: 'medium',
    detail:
      'JavaScript-enabled WebViews need strict URL allowlists, safe browsing, and hardened bridge handling.',
    regex: /\.setJavaScriptEnabled\s*\(\s*true\s*\)/
  },
  {
    id: 'webview-bridge',
    title: 'JavaScript bridge exposed',
    severity: 'high',
    detail:
      'addJavascriptInterface exposes Java/Kotlin objects to web content; restrict origins and avoid sensitive bridge methods.',
    regex: /\.addJavascriptInterface\s*\(/
  },
  {
    id: 'trust-manager',
    title: 'Custom trust manager logic',
    severity: 'high',
    detail:
      'Custom X509TrustManager code can accidentally trust every certificate. Confirm certificate validation fails closed.',
    regex: /X509TrustManager|checkServerTrusted|checkClientTrusted/
  },
  {
    id: 'hostname-verifier',
    title: 'Hostname verifier override',
    severity: 'high',
    detail:
      'HostnameVerifier overrides often disable TLS hostname checks. Verify it delegates to the platform verifier.',
    regex: /HostnameVerifier|ALLOW_ALL_HOSTNAME_VERIFIER|verify\s*\(\s*String\s+\w+\s*,\s*SSLSession/
  },
  {
    id: 'weak-crypto',
    title: 'Weak cryptographic primitive',
    severity: 'medium',
    detail:
      'MD5, SHA-1, DES, RC4, and AES/ECB are weak choices for modern application security.',
    regex: /"(?:(?:AES\/ECB)|DES|RC4|MD5|SHA-?1)"/i
  },
  {
    id: 'hardcoded-iv',
    title: 'Potential hardcoded IV',
    severity: 'medium',
    detail:
      'Static IVs make block cipher modes deterministic. IVs should be random and unique per encryption operation.',
    regex: /new\s+IvParameterSpec\s*\(|IvParameterSpec\s*\(/
  },
  {
    id: 'dynamic-loading',
    title: 'Dynamic code loading',
    severity: 'high',
    detail:
      'DexClassLoader/PathClassLoader can load external code. Audit the source path and signature/integrity checks.',
    regex: /DexClassLoader|PathClassLoader|InMemoryDexClassLoader/
  },
  {
    id: 'runtime-exec',
    title: 'Shell command execution',
    severity: 'medium',
    detail:
      'Runtime.exec and ProcessBuilder calls can become command injection or data exfiltration paths.',
    regex: /Runtime\.getRuntime\(\)\.exec|new\s+ProcessBuilder\s*\(/
  },
  {
    id: 'reflection',
    title: 'Reflection-heavy code path',
    severity: 'low',
    detail:
      'Reflection can hide sensitive behavior from simple review. Trace the target class and method names.',
    regex: /Class\.forName|getDeclaredMethod|getDeclaredField|Method\.invoke/
  },
  {
    id: 'native-load',
    title: 'Native library loading',
    severity: 'info',
    detail:
      'Native code may contain security-sensitive logic outside the Java decompilation view.',
    regex: /System\.loadLibrary|System\.load\s*\(/
  },
  {
    id: 'root-detection',
    title: 'Root or tamper detection',
    severity: 'info',
    detail:
      'Root/tamper checks are useful targets for Frida bypass scripts and runtime validation.',
    regex: /RootBeer|\/system\/bin\/su|\/system\/xbin\/su|magisk|isDeviceRooted|SafetyNet|PlayIntegrity/i
  },
  {
    id: 'sensitive-logging',
    title: 'Sensitive logging candidate',
    severity: 'low',
    detail:
      'Logging in auth, token, crypto, or password flows can leak sensitive values through logcat.',
    regex: /Log\.[devwi]\s*\(.*(?:token|secret|password|auth|key|credential)/i
  }
]

class JadxService {
  private projects = new Map<string, ProjectRecord>()

  async status(): Promise<JadxStatus> {
    const outputRoot = this.outputRoot()
    const binaryPath = toolchainService.binaryPath('jadx')
    if (!binaryPath) {
      return {
        installed: false,
        binaryPath: null,
        version: null,
        outputRoot
      }
    }

    const version = await runCapture(binaryPath, ['--version'], 8_000).catch((err) => ({
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err)
    }))
    const rawVersion = `${version.stdout}\n${version.stderr}`.trim()
    return {
      installed: true,
      binaryPath,
      version: rawVersion.split(/\r?\n/).find(Boolean) ?? null,
      outputRoot,
      errorMessage: version.stdout ? undefined : version.stderr || undefined
    }
  }

  async decompile(rawOptions: JadxDecompileOptions): Promise<JadxProjectSummary> {
    const options = normalizeOptions(rawOptions)
    if (!existsSync(options.inputPath)) {
      throw new Error(`Input file does not exist: ${options.inputPath}`)
    }

    const binaryPath = toolchainService.binaryPath('jadx')
    if (!binaryPath) {
      throw new Error('JADX is not installed. Install it from Settings or the JADX Workbench.')
    }

    const sha = await sha256OfFile(options.inputPath)
    const id = `${sanitizeName(basename(options.inputPath, extname(options.inputPath)))}-${sha.slice(0, 12).toLowerCase()}`
    const outputDir = join(this.outputRoot(), id)
    if (options.clean && existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true })
    }
    mkdirSync(outputDir, { recursive: true })

    const started = Date.now()
    const emitProgress = (
      phase: JadxProgress['phase'],
      percent: number,
      message: string,
      detail?: string
    ): void => {
      bus.emit('jadx:progress', {
        projectId: id,
        inputPath: options.inputPath,
        outputDir,
        phase,
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        message,
        detail
      })
    }
    emitProgress('preparing', 2, 'Preparing JADX output workspace')
    const args = buildJadxArgs(options, outputDir)
    const run = await runProcess(binaryPath, args, 20 * 60_000, (chunk) => {
      const parsed = parseJadxProgress(chunk)
      if (parsed) emitProgress(parsed.phase, parsed.percent, parsed.message)
    }).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      emitProgress('error', 100, 'JADX decompile failed', message)
      throw err
    })
    const durationMs = Date.now() - started
    emitProgress('scanning', 96, 'Indexing decompiled source and resources')
    const apkSummary = await apkAnalyzerService.analyze(options.inputPath).catch(() => null)
    const files = collectFiles(outputDir)
    const combinedLog = `${run.stderr}\n${run.stdout}`
    if (run.exitCode !== 0 && files.length === 0) {
      const detail = cap(combinedLog || 'No files were produced.')
      emitProgress('error', 100, 'JADX failed before producing output', detail)
      throw new Error(`JADX exited with code ${run.exitCode} before producing output.\n${detail}`)
    }
    const completedWithErrors = run.exitCode !== 0 || /finished with errors|ERROR\s+-/i.test(combinedLog)
    const corpus = buildCorpus(files)
    const findings = scanCodeFindings(corpus)
    const project: JadxProjectSummary = {
      id,
      inputPath: options.inputPath,
      outputDir,
      packageName: apkSummary?.packageName ?? null,
      appLabel: apkSummary?.application.label ?? null,
      decompiledAt: new Date().toISOString(),
      durationMs,
      jadxVersion: (await this.status()).version,
      exitCode: run.exitCode,
      completedWithErrors,
      fileCount: files.length,
      sourceFileCount: files.filter((file) => isSourceFile(file.relative)).length,
      resourceFileCount: files.filter((file) => isResourceFile(file.relative)).length,
      manifestFile: files.find((file) => file.relative.endsWith('AndroidManifest.xml'))?.relative ?? null,
      topPackages: topPackages(corpus),
      entryPoints: apkSummary ? mapEntryPoints(apkSummary.components, files, apkSummary.packageName) : [],
      findings,
      secrets: scanCorpus(corpus, []).slice(0, 200),
      endpoints: extractEndpoints(corpus).slice(0, 400),
      stdout: cap(run.stdout),
      stderr: cap(run.stderr)
    }

    this.projects.set(id, { summary: project, outputDir })
    emitProgress(
      'done',
      100,
      completedWithErrors
        ? `JADX completed with recoverable errors${extractJadxErrorCount(combinedLog)}`
        : 'JADX decompile complete',
      completedWithErrors ? cap(combinedLog) : undefined
    )
    return project
  }

  listTree(projectId: string): JadxFileEntry[] {
    const project = this.requireProject(projectId)
    return buildTree(collectFiles(project.outputDir))
  }

  readFile(projectId: string, requestedPath: string): JadxReadFileResult {
    const project = this.requireProject(projectId)
    const file = safeProjectPath(project.outputDir, requestedPath)
    const st = statSync(file)
    if (!st.isFile()) throw new Error('Selected path is not a file')
    const bytesRead = Math.min(st.size, MAX_READ_FILE_BYTES)
    const preview = readFilePreview(file, bytesRead)
    const binary = looksBinary(preview)
    const displayed = binary ? preview.subarray(0, MAX_HEX_PREVIEW_BYTES) : preview
    return {
      path: toPosix(relative(project.outputDir, file)),
      content: binary ? hexPreview(displayed) : displayed.toString('utf8'),
      size: st.size,
      bytesRead: displayed.length,
      truncated: st.size > displayed.length,
      binary
    }
  }

  search(projectId: string, query: string, limit = 200): JadxSearchResult[] {
    const normalized = query.trim()
    if (normalized.length < 2) return []
    const needle = normalized.toLowerCase()
    const project = this.requireProject(projectId)
    const files = collectFiles(project.outputDir)
      .filter((file) => isTextLike(file.relative) && file.size <= MAX_SCAN_FILE_BYTES)
      .slice(0, MAX_SCAN_FILES)
    const out: JadxSearchResult[] = []
    for (const file of files) {
      const lines = readFileSync(file.absolute, 'utf8').split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const column = line.toLowerCase().indexOf(needle)
        if (column === -1) continue
        out.push({
          file: file.relative,
          line: i + 1,
          column: column + 1,
          preview: trimSnippet(line)
        })
        if (out.length >= limit) return out
      }
    }
    return out
  }

  async revealOutput(projectId: string): Promise<void> {
    const project = this.requireProject(projectId)
    await shell.openPath(project.outputDir)
  }

  deleteProject(projectId: string): void {
    const project = this.requireProject(projectId)
    rmSync(project.outputDir, { recursive: true, force: true })
    this.projects.delete(projectId)
  }

  private requireProject(projectId: string): ProjectRecord {
    const project = this.projects.get(projectId)
    if (!project) throw new Error('JADX project is not loaded in this session. Re-run decompilation.')
    return project
  }

  private outputRoot(): string {
    const root = join(getPaths().captures, 'jadx')
    mkdirSync(root, { recursive: true })
    return root
  }
}

function normalizeOptions(options: JadxDecompileOptions): JadxDecompileOptions {
  return {
    inputPath: resolve(options.inputPath),
    clean: options.clean !== false,
    deobfuscate: options.deobfuscate !== false,
    showBadCode: options.showBadCode !== false,
    noResources: options.noResources === true,
    exportGradle: options.exportGradle === true,
    mode: options.mode ?? 'auto',
    threads: Math.max(1, Math.min(16, Number.isFinite(options.threads) ? Math.round(options.threads) : defaultThreads()))
  }
}

function buildJadxArgs(options: JadxDecompileOptions, outputDir: string): string[] {
  const args = [
    '-d',
    outputDir,
    '--decompilation-mode',
    options.mode,
    '--threads-count',
    String(options.threads)
  ]
  if (options.deobfuscate) args.push('--deobf')
  if (options.showBadCode) args.push('--show-bad-code')
  if (options.noResources) args.push('--no-res')
  if (options.exportGradle) args.push('--export-gradle')
  args.push(options.inputPath)
  return args
}

function defaultThreads(): number {
  return Math.max(2, Math.min(8, cpus().length - 1))
}

function runCapture(
  command: string,
  args: readonly string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return runProcess(command, args, timeoutMs).then((run) => {
    if (run.exitCode === 0) return { stdout: run.stdout, stderr: run.stderr }
    throw new Error(`JADX exited with code ${run.exitCode}.\n${run.stderr || run.stdout || 'No output.'}`)
  })
}

function runProcess(
  command: string,
  args: readonly string[],
  timeoutMs: number,
  onChunk?: (chunk: string) => void
): Promise<RunResult> {
  return new Promise((resolveRun, reject) => {
    const child = safeSpawn(command, args, {
      windowsHide: true,
      env: process.env
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error('JADX timed out. Try simple/fallback mode or disable resource decoding.'))
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stdout = cap(stdout + text)
      onChunk?.(text)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stderr = cap(stderr + text)
      onChunk?.(text)
    })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolveRun({ stdout, stderr, exitCode: code })
    })
  })
}

function parseJadxProgress(chunk: string): Pick<JadxProgress, 'phase' | 'percent' | 'message'> | null {
  const progressMatches = [...chunk.matchAll(/progress:\s+\d+\s+of\s+\d+\s+\((\d+)%\)/gi)]
  const progress = progressMatches.at(-1)
  if (progress?.[1]) {
    const percent = Number(progress[1])
    if (Number.isFinite(percent)) {
      return {
        phase: 'processing',
        percent: Math.max(8, Math.min(95, percent)),
        message: `Decompiling classes and resources (${percent}%)`
      }
    }
  }

  if (/loading/i.test(chunk)) {
    return { phase: 'loading', percent: 5, message: 'Loading APK, DEX, and resources' }
  }
  if (/processing/i.test(chunk)) {
    return { phase: 'processing', percent: 10, message: 'Processing bytecode graph' }
  }
  return null
}

function extractJadxErrorCount(log: string): string {
  const count = /finished with errors,\s*count:\s*(\d+)/i.exec(log)?.[1]
  return count ? ` (${count})` : ''
}

function looksBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) return false
  const sampleSize = Math.min(buffer.length, 4096)
  let suspicious = 0
  for (let i = 0; i < sampleSize; i++) {
    const value = buffer[i]!
    if (value === 0) return true
    if (value < 7 || (value > 14 && value < 32)) suspicious++
  }
  return suspicious / sampleSize > 0.08
}

function readFilePreview(file: string, bytes: number): Buffer {
  if (bytes <= 0) return Buffer.alloc(0)
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.allocUnsafe(bytes)
    const read = readSync(fd, buffer, 0, bytes, 0)
    return buffer.subarray(0, read)
  } finally {
    closeSync(fd)
  }
}

function hexPreview(buffer: Buffer): string {
  const lines: string[] = [
    'Binary file preview. Showing a hexadecimal view of the first bytes.',
    ''
  ]
  const limit = Math.min(buffer.length, MAX_HEX_PREVIEW_BYTES)
  for (let offset = 0; offset < limit; offset += 16) {
    const slice = buffer.subarray(offset, Math.min(offset + 16, limit))
    const hex = [...slice].map((byte) => byte.toString(16).padStart(2, '0')).join(' ')
    const ascii = [...slice]
      .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'))
      .join('')
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines.join('\n')
}

function collectFiles(root: string): FileInfo[] {
  const out: FileInfo[] = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(absolute)
        continue
      }
      if (!entry.isFile()) continue
      const st = statSync(absolute)
      out.push({
        absolute,
        relative: toPosix(relative(root, absolute)),
        size: st.size
      })
    }
  }
  return out.sort((a, b) => a.relative.localeCompare(b.relative))
}

function buildCorpus(files: FileInfo[]): CorpusEntry[] {
  const corpus: CorpusEntry[] = []
  for (const file of files.filter((item) => isTextLike(item.relative)).slice(0, MAX_SCAN_FILES)) {
    if (file.size > MAX_SCAN_FILE_BYTES) continue
    try {
      corpus.push({
        source: file.relative,
        lines: readFileSync(file.absolute, 'utf8').split(/\r?\n/)
      })
    } catch {
      // Skip files whose bytes are not valid text for the current decoder.
    }
  }
  return corpus
}

function scanCodeFindings(corpus: CorpusEntry[]): JadxCodeFinding[] {
  const out: JadxCodeFinding[] = []
  for (const entry of corpus) {
    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i]!
      if (line.length > 2_000) continue
      for (const rule of CODE_RULES) {
        if (!rule.regex.test(line)) continue
        out.push({
          id: `${rule.id}:${entry.source}:${i + 1}`,
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          file: entry.source,
          line: i + 1,
          snippet: trimSnippet(line),
          detail: rule.detail
        })
        if (out.length >= 500) return out
      }
    }
  }
  return out.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function topPackages(corpus: CorpusEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const entry of corpus) {
    if (!entry.source.endsWith('.java')) continue
    const line = entry.lines.find((candidate) => candidate.startsWith('package '))
    const pkg = line?.match(/^package\s+([\w.]+);/)?.[1]
    if (!pkg) continue
    const top = pkg.split('.').slice(0, 3).join('.')
    counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
}

function mapEntryPoints(
  components: {
    activities: ApkComponentSummary[]
    services: ApkComponentSummary[]
    receivers: ApkComponentSummary[]
    providers: ApkComponentSummary[]
  },
  files: FileInfo[],
  packageName: string
): JadxEntryPoint[] {
  return [
    ...components.activities.map((component) => entryPoint('activity', component, files, packageName)),
    ...components.services.map((component) => entryPoint('service', component, files, packageName)),
    ...components.receivers.map((component) => entryPoint('receiver', component, files, packageName)),
    ...components.providers.map((component) => entryPoint('provider', component, files, packageName))
  ]
}

function entryPoint(
  type: JadxEntryPoint['type'],
  component: ApkComponentSummary,
  files: FileInfo[],
  packageName: string
): JadxEntryPoint {
  return {
    type,
    component: component.name,
    file: findSourceForClass(component.name, files, packageName),
    exported: component.exported,
    permission: component.permission
  }
}

function findSourceForClass(name: string, files: FileInfo[], packageName: string): string | null {
  const qualified = name.startsWith('.')
    ? `${packageName}${name}`
    : name.includes('.')
      ? name
      : `${packageName}.${name}`
  const candidate = `sources/${qualified.replace(/\./g, '/')}.java`
  const exact = files.find((file) => file.relative === candidate)
  if (exact) return exact.relative
  const simple = `${qualified.split('.').pop()}.java`
  return files.find((file) => file.relative.endsWith(`/${simple}`))?.relative ?? null
}

function buildTree(files: FileInfo[]): JadxFileEntry[] {
  const roots: JadxFileEntry[] = []
  for (const file of files) {
    const parts = file.relative.split('/')
    let level = roots
    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!
      currentPath = currentPath ? `${currentPath}/${name}` : name
      const isFile = i === parts.length - 1
      let node = level.find((entry) => entry.name === name)
      if (!node) {
        node = {
          path: currentPath,
          name,
          kind: isFile ? 'file' : 'directory',
          size: isFile ? file.size : 0,
          language: isFile ? languageForPath(name) : 'folder',
          children: isFile ? undefined : []
        }
        level.push(node)
      }
      if (!isFile) {
        const children = node.children ?? []
        node.children = children
        level = children
      }
    }
  }
  return sortTree(roots)
}

function sortTree(nodes: JadxFileEntry[]): JadxFileEntry[] {
  return nodes
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined
    }))
}

function safeProjectPath(root: string, requestedPath: string): string {
  const resolved = resolve(root, requestedPath)
  const normalizedRoot = resolve(root)
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error('Path escapes the JADX output directory')
  }
  return resolved
}

function isTextLike(path: string): boolean {
  return /\.(java|kt|xml|json|properties|txt|html?|js|css|yml|yaml|smali|cfg|conf|ini|gradle)$/i.test(path)
}

function isSourceFile(path: string): boolean {
  return /\.(java|kt|smali)$/i.test(path)
}

function isResourceFile(path: string): boolean {
  return /(^|\/)resources\//.test(path) || /\.(xml|json|properties|png|webp|jpg|jpeg|gif|arsc)$/i.test(path)
}

function languageForPath(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.java') return 'java'
  if (ext === '.kt') return 'kotlin'
  if (ext === '.xml') return 'xml'
  if (ext === '.json') return 'json'
  if (ext === '.properties' || ext === '.ini' || ext === '.cfg' || ext === '.conf') return 'ini'
  if (ext === '.gradle') return 'groovy'
  if (ext === '.js') return 'javascript'
  if (ext === '.css') return 'css'
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.yml' || ext === '.yaml') return 'yaml'
  return 'plaintext'
}

function trimSnippet(line: string): string {
  const trimmed = line.trim()
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed
}

function sanitizeName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'jadx-project'
}

function severityRank(severity: SecretSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity] ?? 5
}

function cap(text: string): string {
  return text.length > MAX_OUTPUT ? text.slice(text.length - MAX_OUTPUT) : text
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export const jadxService = new JadxService()
