# Release Guide

This guide describes the current release process for maintainers.

## Preflight

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

Review:

- `README.md`
- `docs/architecture.md`
- `CHANGELOG.md`
- `package.json` version

## Build

Windows:

```bash
pnpm build:win
```

Linux:

```bash
pnpm build:linux
```

macOS:

```bash
pnpm build:mac
```

macOS releases should be built, signed, and notarized on macOS.

## Artifact Notes

- Build outputs are written to `release/<version>/`.
- Do not commit release artifacts to Git.
- Attach installers and archives to GitHub Releases.
- Windows and macOS production releases should be code-signed before broad
  distribution.
- Linux packages may require platform-specific native dependency verification.

## Smoke Test Checklist

- App launches.
- Project creation and selection works.
- Device list refresh works.
- Logcat starts and stops.
- Proxy starts and captures traffic in a controlled test.
- Repeater can send a simple request.
- APK Analyzer can inspect a sample APK.
- JADX can decompile a small sample APK.
- Frida UI handles missing/rootless device states gracefully.
