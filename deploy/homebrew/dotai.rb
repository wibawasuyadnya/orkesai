# DotAI Homebrew formula.
#
# Published in the tap repo github.com/wibawasuyadnya/homebrew-dotai
# (as Formula/dotai.rb — keep both copies in sync). Install:
#
#   brew install wibawasuyadnya/dotai/dotai      # one-liner (auto-taps)
#
# New release: bash deploy/release.sh vX.Y.Z — does everything below, plus
# builds/uploads the .dmg/.exe installers to the GitHub release.
class Dotai < Formula
  desc "Local multi-agent AI for your terminal — Claude, Codex, OpenRouter, llama.cpp"
  homepage "https://wibawasuyadnya.github.io/dotai"
  url "https://github.com/wibawasuyadnya/dotai/archive/refs/tags/v0.9.1.tar.gz"
  sha256 "e29c99e86d1a6854e71d37a4acf01071b08fa3d5b8c7d7e2282e0e3f022f8e27"
  license "MIT"
  head "https://github.com/wibawasuyadnya/dotai.git", branch: "main"

  def install
    libexec.install Dir["*"], ".env.example"
    (bin/"dotai").write <<~EOS
      #!/bin/bash
      DIR="$HOME/.config/local-ai"
      if [ ! -f "$DIR/ai-agent.py" ]; then
        bash "#{libexec}/install.sh" --local "#{libexec}"
      fi
      exec python3 "$DIR/ai-agent.py" --talk "$@"
    EOS
  end

  def caveats
    <<~EOS
      First run bootstraps ~/.config/local-ai with YOUR own config:
        dotai                # or add `source ~/.config/local-ai/ai-hook.sh`
                             # to your shell rc for the full `ai` command
      Add your keys to ~/.config/local-ai/.env (OpenRouter), or install the
      claude / codex CLIs, or use neither — the local Hermes model
      auto-downloads on first use (~1 GB).
    EOS
  end

  test do
    assert_predicate libexec/"ai-agent.py", :exist?
  end
end
