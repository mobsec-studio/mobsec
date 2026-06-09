# Frida Scripts Library

Built-in instrumentation scripts shipped with MobSec Studio. Each script is loaded
into the UI's "Built-in scripts" sidebar on launch. The full implementations land
in Phase 5 alongside the Frida runtime integration.

## Conventions

- One `.js` file per script. The filename (kebab-case) becomes the script id.
- A leading JSDoc block provides the human-readable name and description:

  ```js
  /**
   * @name SSL Pinning Bypass (universal)
   * @description Disables certificate pinning across OkHttp, Conscrypt, WebView, ...
   * @target android
   */
  ```

- Scripts must be self-contained — no external `require()` calls beyond Frida's
  built-in `Java`, `Process`, `Module`, etc.

## Planned scripts

- `ssl-pinning-bypass.js`
- `root-detection-bypass.js`
- `emulator-detection-bypass.js`
- `debugger-detection-bypass.js`
- `webview-inspect.js`
- `crypto-logger.js`
