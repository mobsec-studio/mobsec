/// <reference types="vite/client" />

// Vite's `?worker` query suffix produces a class that constructs a Web
// Worker. The default `vite/client` types cover .ts files, but Monaco's
// language workers ship as plain .js, so we have to declare them ourselves.
declare module '*?worker' {
  const WorkerCtor: new () => Worker
  export default WorkerCtor
}

declare module '*?worker&inline' {
  const WorkerCtor: new () => Worker
  export default WorkerCtor
}
