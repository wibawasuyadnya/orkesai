# macOS Setup Notes (this machine)

This repo lives in `~/Documents/local-ai-main`, symlinked to `~/.config/local-ai`
(the path the code hardcodes). The hook is sourced from `~/.zshrc`, and
`ai-hook.sh` was patched for zsh (`precmd` instead of bash's `PROMPT_COMMAND`).

Full usage documentation is in [README.md](README.md). Machine-specific facts:

- **Hardware**: M4 Pro, 24 GB RAM — 14B Q4 models fit; DeepSeek V4 (284B MoE) does not, so it's used via API only.
- **Backends configured in `.env`** (repo root, gitignored): `AI_BACKEND=claude` default (sonnet, via `claude` CLI account login), DeepSeek direct API (`deepseek-v4-flash`), OpenRouter (`deepseek/deepseek-v4-flash`), local Hermes-4-14B. Gemini intentionally unused.
- **DeepSeek direct API needs a balance top-up** (platform.deepseek.com) — the key is valid but returns HTTP 402 until then. The same model works via OpenRouter (`aio`) in the meantime.
- **Aliases**: `aic` (Claude) · `aid` (DeepSeek) · `aio` (OpenRouter) · `ail` (local Hermes).
- **Local model**: `./start-hermes.sh` serves Hermes-4-14B Q4_K_M on :8080; the ~8.8 GB GGUF is already cached in `~/.cache/huggingface`.
- **Rate-limit escape hatch**: if Claude is waiting for token reset, `aid <question>` — or just keep typing, the cascade falls through to DeepSeek/local on failure.
