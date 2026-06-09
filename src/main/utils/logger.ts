import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import winston from 'winston'

let cached: winston.Logger | null = null

export function getLogger(): winston.Logger {
  if (cached) return cached

  const logDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })

  cached = winston.createLogger({
    level: app.isPackaged ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'mobsec' },
    transports: [
      new winston.transports.File({
        filename: join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: join(logDir, 'combined.log'),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 3
      })
    ]
  })

  if (!app.isPackaged) {
    cached.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : ''
            return `${timestamp as string} ${level} ${String(message)}${metaStr}`
          })
        )
      })
    )
  }

  return cached
}

export function getLogDir(): string {
  return join(app.getPath('userData'), 'logs')
}
