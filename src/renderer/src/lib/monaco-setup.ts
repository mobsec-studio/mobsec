/**
 * Local Monaco configuration. Monaco normally loads from a CDN, but our CSP
 * locks scripts to 'self', so we bundle the editor into the renderer and
 * pre-wire the language workers via Vite's `?worker` query imports.
 *
 * Import this module exactly once, before any `<Editor />` component
 * renders. The side effects:
 *   1. Pin `MonacoEnvironment.getWorker` so feature workers (TS, JSON, CSS,
 *      HTML) load from the bundle rather than fetching `worker-loader` paths
 *      from a CDN.
 *   2. Tell `@monaco-editor/react`'s loader to skip its CDN fetch and use
 *      our bundled `monaco-editor` instead.
 */

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker(_workerId: string, label: string): Worker
    }
  }
}

window.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

loader.config({ monaco })
