// Load the REAL built agent into a pid and confirm Java works end-to-end.
// Usage: node scripts/frida-probe-agent.mjs <serial> <pid>
import * as Frida from 'frida'
import { readFileSync } from 'node:fs'

const serial = process.argv[2] || 'emulator-5554'
const pid = parseInt(process.argv[3] || '0', 10)
const source = readFileSync('resources/frida-agent/agent.js', 'utf8')

const device = await Frida.getDevice(serial)
const session = await device.attach(pid)
const script = await session.createScript(source)
script.message.connect((m) => {
  if (m.type === 'send') console.log('[agent send]', JSON.stringify(m.payload))
  else if (m.type === 'error') console.log('[agent ERROR]', m.description)
})
await script.load()
console.log('ping ->', await script.exports.ping())
const report = await script.exports.profile({ injection: 'attach' })
console.log('=== REPORT ===')
console.log('framework :', report.framework.label, '(' + Math.round(report.framework.confidence * 100) + '%)')
console.log('android   :', report.device.androidVersion, 'api', report.device.apiLevel, report.device.abi)
console.log('security  :', report.security.length, 'control(s)')
console.log('networking:', report.networking.map((n) => n.id).join(', ') || '(none)')
console.log('classes   :', report.classes.total, 'loaded')
await session.detach()
process.exit(0)
