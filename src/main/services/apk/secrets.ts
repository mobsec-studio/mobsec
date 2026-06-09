/**
 * Curated catalog of secret/credential patterns.
 *
 * The scanner runs every pattern over every input string (DEX strings,
 * resource strings, decompiled Java when available). Each finding
 * carries severity so the UI can sort and the risk score can weight.
 *
 * Patterns are deliberately conservative: we'd rather miss a faint
 * match than fire a thousand false positives on every base64 substring.
 * Where a pattern is known-noisy (generic high-entropy detector) we
 * gate it behind a minimum length + entropy filter.
 */

import type { SecretFinding, SecretSeverity } from '@shared/types'
export type { SecretSeverity } from '@shared/types'

export interface SecretPattern {
  id: string
  label: string
  /** One-line description shown in the UI. */
  description: string
  severity: SecretSeverity
  /** Anchored regex applied per-line. Must use `(?<value>…)` or rely on
   *  the first capture group for the actual secret value. */
  regex: RegExp
}

export const BUILT_IN_PATTERNS: SecretPattern[] = [
  {
    id: 'aws-access-key',
    label: 'AWS access key ID',
    description: 'Long-lived AWS access key — almost always grants programmatic access to S3/EC2/IAM. Rotate immediately.',
    severity: 'critical',
    regex: /\b(AKIA[0-9A-Z]{16})\b/
  },
  {
    id: 'aws-secret-key',
    label: 'AWS secret access key',
    description: 'Paired with an access-key ID grants full AWS account access. Treat as compromised on disclosure.',
    severity: 'critical',
    // The classic 40-char base64-ish AWS secret. Gate on an `aws` /
    // `secret` hint within the same line to dodge generic base64.
    regex: /(?:aws|secret|s3)[^\n]{0,40}["':=\s]([A-Za-z0-9/+=]{40})\b/i
  },
  {
    id: 'google-api-key',
    label: 'Google API key',
    description: 'Used for Maps, YouTube, Translate, etc. Often restricted but always worth flagging.',
    severity: 'high',
    regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/
  },
  {
    id: 'google-oauth-token',
    label: 'Google OAuth access token',
    description: 'Short-lived but powerful — if shipped it usually means a flow leaked tokens into logs/strings.',
    severity: 'high',
    regex: /\b(ya29\.[0-9A-Za-z\-_]+)\b/
  },
  {
    id: 'firebase-url',
    label: 'Firebase database URL',
    description: "Unauthenticated Firebase DBs are a common breach vector — confirm rules aren't `read: true`.",
    severity: 'medium',
    regex: /\b(https?:\/\/[a-z0-9-]+\.firebaseio\.com)\b/i
  },
  {
    id: 'firebase-app-config',
    label: 'Firebase web app config',
    description: 'Embedded Firebase config block. Confirm Security Rules + App Check are enforced.',
    severity: 'low',
    regex: /\b(AAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{134})\b/
  },
  {
    id: 'github-token-classic',
    label: 'GitHub personal access token (classic)',
    description: 'Grants repo-level access. Immediate revoke + audit recommended.',
    severity: 'critical',
    regex: /\b(ghp_[A-Za-z0-9]{36,})\b/
  },
  {
    id: 'github-token-fine',
    label: 'GitHub fine-grained PAT',
    description: 'Scoped GitHub token. Still grants broad write access depending on scopes.',
    severity: 'critical',
    regex: /\b(github_pat_[A-Za-z0-9_]{82})\b/
  },
  {
    id: 'github-oauth',
    label: 'GitHub OAuth access token',
    description: 'OAuth tokens auto-expire but still allow attacker actions within their lifetime.',
    severity: 'high',
    regex: /\b(gho_[A-Za-z0-9]{36})\b/
  },
  {
    id: 'gitlab-token',
    label: 'GitLab personal access token',
    description: 'Long-lived token grants API access — treat as critical.',
    severity: 'critical',
    regex: /\b(glpat-[A-Za-z0-9\-_]{20,})\b/
  },
  {
    id: 'slack-bot-token',
    label: 'Slack bot token',
    description: 'Allows reading and posting to Slack workspaces — exfiltration vector.',
    severity: 'high',
    regex: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/
  },
  {
    id: 'slack-webhook',
    label: 'Slack incoming webhook',
    description: 'Anyone with this URL can post to the target channel.',
    severity: 'medium',
    regex: /\b(https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+)\b/
  },
  {
    id: 'discord-webhook',
    label: 'Discord webhook',
    description: 'Direct write access to a Discord channel — common in malware exfil.',
    severity: 'medium',
    regex: /\b(https:\/\/(?:discord(?:app)?)\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+)\b/
  },
  {
    id: 'stripe-secret-key',
    label: 'Stripe secret key (live)',
    description: 'Live Stripe key — full charge/refund powers on the merchant account. Critical.',
    severity: 'critical',
    regex: /\b(sk_live_[A-Za-z0-9]{24,})\b/
  },
  {
    id: 'stripe-restricted-key',
    label: 'Stripe restricted key',
    description: 'Scoped Stripe key. Still production-grade — review scopes.',
    severity: 'high',
    regex: /\b(rk_live_[A-Za-z0-9]{24,})\b/
  },
  {
    id: 'stripe-test-key',
    label: 'Stripe test secret key',
    description: 'Test-mode key. Not exploitable for real money but still a leak.',
    severity: 'low',
    regex: /\b(sk_test_[A-Za-z0-9]{24,})\b/
  },
  {
    id: 'twilio-sid',
    label: 'Twilio Account SID',
    description: 'Paired with an auth token allows SMS/voice abuse on the account.',
    severity: 'medium',
    regex: /\b(AC[a-f0-9]{32})\b/
  },
  {
    id: 'sendgrid-api-key',
    label: 'SendGrid API key',
    description: 'Sends mail on behalf of the account — phishing and reputation risk.',
    severity: 'high',
    regex: /\b(SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43})\b/
  },
  {
    id: 'mailgun-key',
    label: 'Mailgun API key',
    description: 'Mail send/list management.',
    severity: 'high',
    regex: /\b(key-[a-z0-9]{32})\b/
  },
  {
    id: 'square-token',
    label: 'Square access token',
    description: 'Payment processing access. Critical for live keys.',
    severity: 'critical',
    regex: /\b(sq0(?:atp|csp)-[A-Za-z0-9_-]{22,})\b/
  },
  {
    id: 'jwt',
    label: 'JWT token',
    description: 'Could be an OAuth bearer, identity proof, or a debug fixture. Always inspect claims.',
    severity: 'medium',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/
  },
  {
    id: 'private-key',
    label: 'PEM private key',
    description: 'A private key shipped inside an APK should never exist. Anyone with the APK has the key.',
    severity: 'critical',
    regex: /(-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----)/
  },
  {
    id: 'basic-auth-url',
    label: 'URL with basic-auth credentials',
    description: '`https://user:pass@host` URLs ship credentials in plaintext.',
    severity: 'high',
    regex: /\b(https?:\/\/[^\s:@/"']+:[^\s@/"']+@[^\s/"']+)/
  },
  {
    id: 'azure-storage-key',
    label: 'Azure storage account key',
    description: 'Full read/write to a storage account.',
    severity: 'critical',
    regex: /\b(DefaultEndpointsProtocol=https;AccountName=[a-z0-9]+;AccountKey=[A-Za-z0-9+/=]{60,})/
  },
  {
    id: 'mapbox-token',
    label: 'Mapbox access token',
    description: 'Maps usage. Generally low-risk but worth tracking.',
    severity: 'low',
    regex: /\b(pk\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/
  },
  {
    id: 'algolia-admin',
    label: 'Algolia admin API key',
    description: 'Full index write — destructive abuse possible.',
    severity: 'high',
    regex: /\b(algolia[^a-zA-Z0-9]{0,5}[A-Za-z0-9]{32})\b/i
  },
  {
    id: 'sentry-dsn',
    label: 'Sentry DSN',
    description: 'Embedded DSNs are normal but worth listing — sometimes server DSNs leak by mistake.',
    severity: 'low',
    regex: /\b(https:\/\/[a-f0-9]{32}@(?:[a-z0-9-]+\.)?(?:ingest\.)?sentry\.io\/\d+)/i
  },
  {
    id: 'rsa-public-key',
    label: 'PEM public key (informational)',
    description: 'Public keys are not secrets but listing them speeds up cert-pin / signature reviews.',
    severity: 'info',
    regex: /(-----BEGIN PUBLIC KEY-----)/
  },
  {
    id: 'generic-secret-assignment',
    label: 'Hardcoded "secret/token/password" assignment',
    description: 'A string literal assigned to a variable named `password`, `secret`, `apiKey`, `token`, etc. Inspect manually.',
    severity: 'medium',
    regex:
      /\b(?:password|passwd|secret|api[_-]?key|apikey|auth[_-]?token|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']([^"'\s]{6,})["']/i
  },
  // ---- LLM / AI provider keys ------------------------------------------
  {
    id: 'openai-api-key',
    label: 'OpenAI API key',
    description: 'Live OpenAI key — anyone with it can rack up significant model bills on the owner\'s account. Treat as critical.',
    severity: 'critical',
    regex: /\b(sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,})\b/
  },
  {
    id: 'anthropic-api-key',
    label: 'Anthropic Claude API key',
    description: 'Live Anthropic key. Costly model abuse possible — rotate immediately.',
    severity: 'critical',
    regex: /\b(sk-ant-api03-[A-Za-z0-9_-]{93,})\b/
  },
  {
    id: 'cohere-api-key',
    label: 'Cohere API key',
    description: 'Cohere production key. LLM abuse via Generate / Embed endpoints.',
    severity: 'high',
    regex: /\b(co_[A-Za-z0-9]{32,})\b/
  },
  {
    id: 'huggingface-token',
    label: 'Hugging Face access token',
    description: 'Read/write access to private HF repos and inference endpoints.',
    severity: 'high',
    regex: /\b(hf_[A-Za-z0-9]{30,})\b/
  },
  {
    id: 'replicate-token',
    label: 'Replicate API token',
    description: 'Replicate model inference token — paid usage on the owner\'s account.',
    severity: 'high',
    regex: /\b(r8_[A-Za-z0-9]{40})\b/
  },
  // ---- Dev tools / SaaS API tokens -------------------------------------
  {
    id: 'notion-token',
    label: 'Notion integration secret',
    description: 'Full read/write to whatever workspace pages the integration is shared with.',
    severity: 'high',
    regex: /\b(secret_[A-Za-z0-9]{43})\b/
  },
  {
    id: 'linear-api-key',
    label: 'Linear API key',
    description: 'Workspace-level access to issues, projects, and members.',
    severity: 'high',
    regex: /\b(lin_api_[A-Za-z0-9]{40})\b/
  },
  {
    id: 'postman-api-key',
    label: 'Postman API key',
    description: 'Read/write to the team\'s collections, environments, and monitors.',
    severity: 'high',
    regex: /\b(PMAK-[A-Fa-f0-9]{24}-[A-Fa-f0-9]{34})\b/
  },
  {
    id: 'atlassian-token',
    label: 'Atlassian (Jira/Confluence/Bitbucket) API token',
    description: 'Full access to the issuing user\'s Atlassian Cloud workspace.',
    severity: 'critical',
    regex: /\b(ATATT[A-Za-z0-9+/=_-]{50,})\b/
  },
  {
    id: 'vercel-token',
    label: 'Vercel access token',
    description: 'Full project deploy / env-var access on Vercel.',
    severity: 'critical',
    regex: /(?:vercel|vc)[_-]?(?:api[_-]?)?(?:token|key)["'\s:=]+([A-Za-z0-9]{24})\b/i
  },
  {
    id: 'cloudflare-api-token',
    label: 'Cloudflare API token',
    description: 'Scoped Cloudflare token — workers, DNS, R2, edge cache invalidation.',
    severity: 'critical',
    regex: /\b([A-Za-z0-9_-]{40})\b(?=.{0,200}cloudflare)/i
  },
  {
    id: 'heroku-api-key',
    label: 'Heroku API key',
    description: 'Heroku platform credential — app deploy, env vars, add-ons.',
    severity: 'critical',
    regex: /(?:heroku|HEROKU_API)["'\s:=]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i
  },
  {
    id: 'npm-token',
    label: 'NPM publish token',
    description: 'Publishes / yanks packages on the owner\'s NPM account.',
    severity: 'critical',
    regex: /\b(npm_[A-Za-z0-9]{36})\b/
  },
  {
    id: 'datadog-api-key',
    label: 'Datadog API key',
    description: 'Ingestion + read access to the org\'s telemetry.',
    severity: 'high',
    regex: /(?:datadog|DD_API)["'\s:=]+([a-f0-9]{32})\b/i
  },
  {
    id: 'pagerduty-integration-key',
    label: 'PagerDuty integration key',
    description: 'Lets anyone fire alerts (and so DoS the on-call rotation).',
    severity: 'medium',
    regex: /\b([A-Fa-f0-9]{32})\b(?=.{0,200}pagerduty)/i
  },
  {
    id: 'twilio-auth-token',
    label: 'Twilio auth token',
    description: 'Paired with the Account SID grants SMS/voice sending and recording access.',
    severity: 'critical',
    regex: /\b([a-f0-9]{32})\b(?=.{0,200}twilio)/i
  },
  {
    id: 'stripe-webhook-secret',
    label: 'Stripe webhook signing secret',
    description: 'Lets attackers forge Stripe webhook events to the server.',
    severity: 'critical',
    regex: /\b(whsec_[A-Za-z0-9]{32,})\b/
  },
  {
    id: 'gitlab-deploy-token',
    label: 'GitLab deploy token',
    description: 'Pull/push access to specific GitLab repositories.',
    severity: 'high',
    regex: /\b(gldt-[A-Za-z0-9_-]{20,})\b/
  },
  // ---- Database connection strings -------------------------------------
  {
    id: 'postgres-url',
    label: 'PostgreSQL connection URL with credentials',
    description: 'Includes user:password — direct database access.',
    severity: 'critical',
    regex: /\b(postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]+@[^/\s'"]+(?:\/[^\s'"]*)?)/i
  },
  {
    id: 'mysql-url',
    label: 'MySQL connection URL with credentials',
    description: 'Includes user:password — direct database access.',
    severity: 'critical',
    regex: /\b(mysql:\/\/[^:\s'"]+:[^@\s'"]+@[^/\s'"]+(?:\/[^\s'"]*)?)/i
  },
  {
    id: 'mongodb-url',
    label: 'MongoDB connection URL with credentials',
    description: 'Includes user:password — direct MongoDB access.',
    severity: 'critical',
    regex: /\b(mongodb(?:\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@[^/\s'"]+(?:\/[^\s'"]*)?)/i
  },
  {
    id: 'redis-url',
    label: 'Redis connection URL with credentials',
    description: 'Includes user:password — direct Redis access.',
    severity: 'high',
    regex: /\b(redis(?:s)?:\/\/[^:\s'"]+:[^@\s'"]+@[^/\s'"]+(?::\d+)?(?:\/\d+)?)/i
  },
  // ---- Misc -------------------------------------------------------------
  {
    id: 'gcm-server-key',
    label: 'Google Cloud Messaging / FCM server key (legacy)',
    description: 'Lets anyone push notifications to every device registered to the Firebase project.',
    severity: 'critical',
    regex: /\b(AAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{134,})\b/
  },
  {
    id: 'jdbc-url-with-password',
    label: 'JDBC URL with embedded password',
    description: 'jdbc:driver://host?password=... or password=... query string — full DB credentials.',
    severity: 'critical',
    regex: /\b(jdbc:[a-z]+:[^\s'"]+[?&;]password=[^\s&'";]+)/i
  },
  {
    id: 'ssh-private-key',
    label: 'SSH private key',
    description: 'Shipping an SSH private key inside an APK exposes server access to anyone who downloads the app.',
    severity: 'critical',
    regex: /(-----BEGIN (?:OPENSSH|RSA|DSA|EC) PRIVATE KEY-----[A-Za-z0-9+/=\s]+-----END (?:OPENSSH|RSA|DSA|EC) PRIVATE KEY-----)/
  }
]

/**
 * Run the full pattern catalog (plus optional user patterns) against a
 * corpus. The corpus is a list of `{ source, lines }` because we want
 * to retain the file/path context for each finding without re-loading
 * files in the renderer.
 */
export interface CorpusEntry {
  source: string
  lines: string[]
}

export function scanCorpus(
  corpus: CorpusEntry[],
  customPatterns: SecretPattern[] = []
): SecretFinding[] {
  const out: SecretFinding[] = []
  const seen = new Set<string>()
  const all = [...BUILT_IN_PATTERNS, ...customPatterns]

  for (const entry of corpus) {
    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i]!
      if (line.length > 4096) continue // skip absurdly long lines, almost always minified
      for (const pat of all) {
        const m = pat.regex.exec(line)
        if (!m) continue
        const value = m[1] ?? m[0]
        const dedupe = `${pat.id}::${value}`
        if (seen.has(dedupe)) continue
        seen.add(dedupe)
        out.push({
          patternId: pat.id,
          patternLabel: pat.label,
          severity: pat.severity,
          value,
          context: line.length > 240 ? line.slice(0, 240) + '…' : line,
          source: entry.source,
          line: i + 1
        })
      }
    }
  }

  // Sort: critical → info, then by source path for stable display.
  const order: Record<SecretSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4
  }
  out.sort((a, b) => {
    const o = order[a.severity] - order[b.severity]
    return o !== 0 ? o : a.source.localeCompare(b.source)
  })
  return out
}
