// Validate the standalone Java-bridge shim that gets prepended to raw
// built-in/user scripts. Usage: node scripts/frida-probe-bridge.mjs <serial> <pid>
import * as Frida from 'frida'
import { readFileSync } from 'node:fs'

const serial = process.argv[2] || 'emulator-5554'
const pid = parseInt(process.argv[3] || '0', 10)
const bridge = readFileSync('resources/frida-agent/java-bridge.js', 'utf8')

const test = `
  send('typeof Java after bridge = ' + (typeof Java));
  function whenJavaReady(cb){ if (typeof Java !== 'undefined' && Java.available) Java.perform(cb); else setTimeout(function(){whenJavaReady(cb)},50); }
  whenJavaReady(function(){
    send('Java.available = ' + Java.available);
    var Act = Java.use('android.app.Activity');
    send('Java.use OK -> ' + Act.$className);
  });
`

const device = await Frida.getDevice(serial)
const session = await device.attach(pid)
const script = await session.createScript(bridge + '\n;\n' + test)
script.message.connect((m) => {
  if (m.type === 'send') console.log('>>', m.payload)
  else if (m.type === 'error') console.log('ERR', m.description)
})
await script.load()
await new Promise((r) => setTimeout(r, 2500))
await session.detach()
process.exit(0)
