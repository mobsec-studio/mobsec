# Security Policy

MobSec Studio is a dual-use security tool intended for authorized Android
application assessment, research, and defensive validation.

## Supported Versions

MobSec Studio is currently in public beta. Security fixes are applied to the
latest beta line.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting A Vulnerability

Please do not open a public issue for vulnerabilities in MobSec Studio itself.

Send a private report to:

- hello@mobsec.studio

Include:

- A clear description of the issue.
- Affected version or commit.
- Steps to reproduce.
- Impact and realistic attack scenario.
- Any suggested fix or mitigation.

We aim to acknowledge valid reports promptly and coordinate a fix before public
disclosure.

## Responsible Use

Only use MobSec Studio against apps, devices, accounts, and networks where you
have explicit authorization. The maintainers do not support misuse, credential
theft, unauthorized access, persistence, or stealthy deployment.

## Security Boundaries

MobSec Studio is designed with these boundaries:

- Renderer code has no direct Node integration.
- Privileged operations run in the Electron main process.
- IPC should be typed and validated.
- External tools run locally and are user-controlled.
- Project data stays local by default.
- No telemetry or cloud synchronization is built into the app.
