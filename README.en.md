<p align="center">
  <img src="apps/web/public/logo.png" width="160" alt="pig" />
</p>

# pig

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A522.19-green" />
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
</p>

**[简体中文](README.md)** · English

> A **Pi Agent GUI** that follows Pi's design philosophy: no extra built-in tools; all capabilities come from the Extension API.

## Requirements

- Node.js >= 22.19
- pnpm 11.5
- Models and auth already configured in Pi: pig reuses the `~/.pi` model config and writes sessions to `~/.pi/agent/sessions/<cwd>/`, shared with the Pi CLI

## Quick start

```bash
pnpm install
pnpm dev:web        # start Gateway and Web, then open the printed http://127.0.0.1:5173 in a browser
pnpm dev:desktop    # Electron desktop development
```

## Configuration

| Variable          | Default    | Meaning                                                      |
| ----------------- | ---------- | ------------------------------------------------------------ |
| `PORT`            | `8787`     | Gateway port                                                 |
| `OPEN`            | off        | Set to `1` to open a browser after startup; same as `--open` |
| `PIG_SESSION_DIR` | Pi default | Session directory                                            |
| `PIG_CWD`         | none       | Initial working directory                                    |

## Local security

The Gateway binds `127.0.0.1` only. The browser trades a one-time launch credential for a cookie pass, and every later HTTP and WebSocket request must carry it. A session directory enters the allowlist only after the user picks it, and the list is recorded in `~/.pig/authorized-workspaces.json`.

## Docs

- [`DESIGN.md`](DESIGN.md) — design system and visual rules
- [`ROADMAP.md`](ROADMAP.md) — architecture and boundary principles
- [`docs/JOURNEYS.md`](docs/JOURNEYS.md) — core user journeys
- [`docs/directory-structure.md`](docs/directory-structure.md) — directory and module conventions

## Development

- `pnpm check:touched` — check the files this change touched
- `pnpm check` — full check
- `pnpm test` / `pnpm test:e2e` — module tests / browser journeys
- `pnpm dev:debug` — same as `dev:web`, plus the 9229 inspector
- Commit and collaboration rules: [`AGENTS.md`](AGENTS.md)

## License

[MIT](LICENSE)
