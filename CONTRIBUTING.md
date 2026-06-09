# Contributing

Thank you for helping improve MobSec Studio. This project is a local-first
Android security workbench, so contributions should preserve user control,
clear security boundaries, and cross-platform behavior.

## Ground Rules

- Use MobSec Studio only for authorized security work.
- Keep renderer code isolated from Node/Electron APIs.
- Add new privileged capabilities through typed preload and main-process IPC.
- Prefer structured process arguments over shell string composition.
- Keep Windows, Linux, and macOS behavior in mind when changing paths, tools,
  packaging, or process management.
- Do not commit downloaded tools, generated builds, device data, private APKs,
  credentials, captures, or local logs.

## Development Setup

Prerequisites:

- Node.js 20 or newer.
- pnpm 8 or newer.
- Git.

```bash
pnpm install
pnpm dev
```

## Validation

Run these before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

For Frida agent changes, make sure the generated bundles are refreshed:

```bash
pnpm build:agent
```

## Pull Requests

Good pull requests are focused and easy to review.

- Explain the user-facing problem.
- Describe the implementation approach.
- Include screenshots or short recordings for UI changes.
- Note platform coverage: Windows, Linux, macOS.
- Mention any known limitations.
- Keep unrelated refactors out of feature or bug-fix PRs.

## Security-Sensitive Changes

For changes involving IPC, ADB, Frida, filesystem writes, child processes,
network proxying, certificates, or root flows, include a short security note in
the PR description. Explain what input is trusted, what input is untrusted, and
where validation happens.
