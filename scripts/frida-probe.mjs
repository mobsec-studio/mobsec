// One-off diagnostic: attach to a pid and report whether the GumJS runtime
// exposes the global `Java` bridge (Frida 17 removed it from raw scripts).
// Usage: node scripts/frida-probe.mjs <serial> <pid>
import * as Frida from 'frida'

const serial = process.argv[2] || 'emulator-5554'
const pid = parseInt(process.argv[3] || '0', 10)

const device = await Frida.getDevice(serial)
const session = await device.attach(pid)
const script = await session.createScript(`
  rpc.exports = {
    probe: function () {
      var hasJava = (typeof Java !== 'undefined');
      var avail = false;
      try { avail = hasJava ? Java.available : false; } catch (e) {}
      var g = [];
      try { g = Object.getOwnPropertyNames(globalThis).filter(function (k) {
        return /^(Java|ObjC|Swift|Module|Process|Interceptor|rpc|send|Memory)$/.test(k);
      }); } catch (e) {}
      return {
        fridaVersion: (typeof Frida !== 'undefined') ? Frida.version : 'n/a',
        scriptRuntime: (typeof Script !== 'undefined' && Script.runtime) ? Script.runtime : 'unknown',
        hasJavaGlobal: hasJava,
        javaAvailable: avail,
        notableGlobals: g
      };
    }
  };
`)
await script.load()
const r = await script.exports.probe()
console.log(JSON.stringify(r, null, 2))
await session.detach()
process.exit(0)
