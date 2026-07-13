# Contributing to OrkesAI

Everything lives in this one repo: the Python engine (`modules/`, `server/`),
the terminal client (`ai-agent.py`), and the desktop app (`gui/`). One clone
gives you the whole product; most features touch the engine and the GUI in the
same PR, and that's fine — ship them together.

## Dev setup

```bash
git clone https://github.com/wibawasuyadnya/orkesai.git
cd orkesai
cp .env.example .env            # add an OpenRouter key to actually chat

# API server (stdlib-only Python 3.9+, no pip packages)
python3 server/server.py        # http://127.0.0.1:8765

# Desktop app in dev mode (hot reload)
cd gui
npm install
npm run app                     # next dev + electron pointed at :3000
```

The terminal client works from the same checkout: `python3 ai-agent.py --talk`.
The server and both frontends share `~/.config/orkesai` at runtime — on a dev
machine you can symlink that to your checkout so all three use one config.

## Layout

| Path | What it is |
| :--- | :--- |
| `server/server.py` | HTTP + SSE API on :8765 (stdlib only) |
| `modules/agent_service.py` | the engine: sessions, @roles, groups, streaming, notes |
| `modules/agent_automations.py` | automations: trigger → prompt → actions + scheduler |
| `ai-agent.py` + `modules/agent_*.py` | terminal client |
| `gui/app`, `gui/components`, `gui/lib` | Next.js UI |
| `gui/electron/` | desktop shell: spawns the server, bundles python + payload |
| `deploy/` | docker compose (self-host) and `release.sh` (one-command release) |

## Ground rules

- **Python stays stdlib-only.** No pip dependencies — that's what makes the
  self-contained desktop app and the zero-dep CLI install possible.
- **User data is sacred.** Anything under `~/.config/orkesai` that a user made
  (.env, agents, sessions, notes, automations, groups) must survive updates.
- Match the style around you; comments explain *why*, not *what*.
- Test what you touch: `python3 -m py_compile` for the engine,
  `npx tsc --noEmit` in `gui/` for the UI, and actually run the flow you changed.
- PRs: one feature or fix per PR, with a short description of the behavior
  change. Screenshots welcome for UI work.

## Releases (maintainer)

`bash deploy/release.sh vX.Y.Z` — tags, bumps the brew formula + tap, builds
the three self-contained installers (each embeds a standalone CPython), and
publishes the GitHub release.
