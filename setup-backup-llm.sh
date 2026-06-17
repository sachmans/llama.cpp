#!/bin/bash
# setup-backup-llm.sh — Install llama.cpp + counsel as a backup local LLM server
#
# Run this on any Mac (MacBook, Mac mini, etc.) to set up:
#   1. llama.cpp (TurboQuant fork) — built from source
#   2. Model downloads — sized for your machine's RAM
#   3. models.ini — configured for your hardware
#   4. sn_llama_counsel — multi-model advisory panel UI
#   5. LaunchAgents — auto-start on boot
#
# Usage:
#   curl -sL <gist-url> | bash          # or
#   ./setup-backup-llm.sh               # run locally
#
# Requirements: Xcode CLT, Homebrew, git, cmake
# Tested on: macOS 14+ (Apple Silicon)

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
bold()   { printf "\033[1m%s\033[0m\n" "$1"; }

# ── Detect hardware ──────────────────────────────────────────────────────────
RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
CPU_CORES=$(sysctl -n hw.ncpu)
CHIP=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")

bold "════════════════════════════════════════════════════════════"
bold "  Backup Local LLM Server Setup"
bold "════════════════════════════════════════════════════════════"
echo "  Machine:  $(hostname)"
echo "  Chip:     $CHIP"
echo "  RAM:      ${RAM_GB} GB"
echo "  Cores:    $CPU_CORES"
echo "  User:     $(whoami)"
echo ""

# ── Determine model tier based on RAM ─────────────────────────────────────────
# Reserve ~8GB for OS + apps
USABLE_RAM=$(( RAM_GB - 8 ))

if [ $USABLE_RAM -ge 80 ]; then
    TIER="xl"
    yellow "Tier: XL (80GB+ usable) — all models including 70B"
elif [ $USABLE_RAM -ge 48 ]; then
    TIER="large"
    yellow "Tier: Large (48GB+ usable) — up to 32B models"
elif [ $USABLE_RAM -ge 24 ]; then
    TIER="medium"
    yellow "Tier: Medium (24GB+ usable) — up to 14B models"
elif [ $USABLE_RAM -ge 12 ]; then
    TIER="small"
    yellow "Tier: Small (12GB+ usable) — 7-8B models only"
else
    red "Warning: Only ${USABLE_RAM}GB usable RAM. Models may be slow."
    TIER="tiny"
fi

echo ""
read -p "Continue with tier '$TIER'? [Y/n] " confirm
if [[ "${confirm:-Y}" =~ ^[Nn] ]]; then
    echo "Aborted."
    exit 0
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────
bold "Step 1: Checking prerequisites..."

if ! command -v brew &>/dev/null; then
    red "Homebrew not found. Install from https://brew.sh"
    exit 1
fi

if ! command -v cmake &>/dev/null; then
    echo "Installing cmake..."
    brew install cmake
fi

if ! command -v python3 &>/dev/null; then
    echo "Installing python..."
    brew install python
fi

# mitmweb is optional (for debugging LLM calls)
if ! command -v mitmweb &>/dev/null; then
    echo "Installing mitmproxy (for LLM call inspector)..."
    brew install mitmproxy
fi

green "  Prerequisites OK ✓"

# ── Clone and build llama.cpp ─────────────────────────────────────────────────
bold "Step 2: Building llama.cpp (TurboQuant fork)..."

LLAMA_DIR="$HOME/llama.cpp"
if [ -d "$LLAMA_DIR/.git" ]; then
    echo "  llama.cpp already cloned, pulling latest..."
    cd "$LLAMA_DIR"
    git fetch sekondbrain 2>/dev/null || git remote add sekondbrain https://github.com/SeKondBrainAILabs/llama.cpp-turboquant.git
    git fetch sekondbrain
    # Only reset if on master
    if [ "$(git branch --show-current)" = "master" ]; then
        git reset --hard sekondbrain/master
    fi
else
    echo "  Cloning llama.cpp-turboquant..."
    git clone https://github.com/SeKondBrainAILabs/llama.cpp-turboquant.git "$LLAMA_DIR"
    cd "$LLAMA_DIR"
    git remote add sekondbrain https://github.com/SeKondBrainAILabs/llama.cpp-turboquant.git 2>/dev/null || true
fi

echo "  Building (this takes 2-5 minutes)..."
cmake -B build -DGGML_METAL=ON -DGGML_ACCELERATE=ON -DCMAKE_BUILD_TYPE=Release 2>&1 | tail -3
cmake --build build -j$(sysctl -n hw.ncpu) 2>&1 | tail -5

if [ ! -x build/bin/llama-server ]; then
    red "Build failed! Check build output."
    exit 1
fi
green "  llama.cpp built ✓"

# ── Download models ───────────────────────────────────────────────────────────
bold "Step 3: Downloading models for tier '$TIER'..."

LLAMA_SERVER="$LLAMA_DIR/build/bin/llama-server"

download_model() {
    local name="$1"
    local repo="$2"
    local desc="$3"
    echo "  Downloading $name ($desc)..."
    # Use llama-server's built-in HF downloader (just start and kill)
    timeout 300 "$LLAMA_SERVER" --hf-repo "$repo" -ngl 0 --port 0 --ctx-size 64 2>&1 | grep -E "download|loaded|error" | head -5
    echo "    Done."
}

# Always download (all tiers)
download_model "Llama-3.1-8B" "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M" "~5GB, fast general"
download_model "Qwen2.5-VL-7B" "ggml-org/Qwen2.5-VL-7B-Instruct-GGUF" "~5GB, vision"
download_model "nomic-embed" "nomic-ai/nomic-embed-text-v1.5-GGUF" "~130MB, embeddings"

# Medium tier and above (24GB+)
if [[ "$TIER" =~ ^(medium|large|xl)$ ]]; then
    download_model "Gemma3-4B" "ggml-org/gemma-3-4b-it-GGUF" "~3GB, fast"
    download_model "Qwen2.5-7B" "bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M" "~4.5GB"
fi

# Large tier and above (48GB+)
if [[ "$TIER" =~ ^(large|xl)$ ]]; then
    download_model "Qwen3-32B" "ggml-org/Qwen3-32B-GGUF:Q4_K_M" "~18GB, reasoning"
    download_model "QwQ-32B" "Qwen/QwQ-32B-GGUF:Q4_K_M" "~18GB, reasoning"
    download_model "Gemma4-31B" "bartowski/google_gemma-4-31B-it-GGUF:Q4_K_M" "~18GB"
fi

# XL tier (80GB+)
if [ "$TIER" = "xl" ]; then
    download_model "Llama-3.3-70B" "bartowski/Llama-3.3-70B-Instruct-GGUF:Q4_K_M" "~40GB"
    download_model "Qwen2.5-72B" "bartowski/Qwen2.5-72B-Instruct-GGUF:Q3_K_M" "~32GB"
fi

green "  Models downloaded ✓"

# ── Generate models.ini ──────────────────────────────────────────────────────
bold "Step 4: Writing models.ini..."

# Determine max models and KV cache based on RAM
if [ $USABLE_RAM -ge 80 ]; then
    MODELS_MAX=3
    DEFAULT_KV_K="tbq4_0"
    DEFAULT_KV_V="tbq3_0"
    CTX=32768
elif [ $USABLE_RAM -ge 48 ]; then
    MODELS_MAX=2
    DEFAULT_KV_K="tbq4_0"
    DEFAULT_KV_V="tbq3_0"
    CTX=16384
elif [ $USABLE_RAM -ge 24 ]; then
    MODELS_MAX=2
    DEFAULT_KV_K="q8_0"
    DEFAULT_KV_V="q8_0"
    CTX=8192
else
    MODELS_MAX=1
    DEFAULT_KV_K="q8_0"
    DEFAULT_KV_V="q8_0"
    CTX=4096
fi

cat > "$LLAMA_DIR/models.ini" << INIEOF
version = 1

; Auto-generated for $(hostname) — ${RAM_GB}GB RAM, tier=$TIER
; TBQ KV cache: 4x context vs F16, <1% quality loss
[*]
n-gpu-layers = 99
ctx-size = $CTX
flash-attn = on
cache-type-k = $DEFAULT_KV_K
cache-type-v = $DEFAULT_KV_V

; ── Core models (always available) ────────────────────────────────────────────

[llama-3.1-8b-instant]
hf-repo = bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
ctx-size = 8192
cache-type-k = q8_0
cache-type-v = q8_0
parallel = 4

[qwen2.5-vl-7b]
hf-repo = ggml-org/Qwen2.5-VL-7B-Instruct-GGUF
cache-type-k = q8_0
cache-type-v = q8_0

[nomic-embed-text-v1.5]
hf-repo = nomic-ai/nomic-embed-text-v1.5-GGUF
embeddings = true
parallel = 4
batch-size = 8192
ubatch-size = 8192

; ── Groq-parity aliases ──────────────────────────────────────────────────────

[gpt-4o-mini]
hf-repo = bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
cache-type-k = q8_0
cache-type-v = q8_0

[claude-haiku-4-5-20251001]
hf-repo = bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M
cache-type-k = q8_0
cache-type-v = q8_0

[gemini-2.5-flash-image]
hf-repo = ggml-org/Qwen2.5-VL-7B-Instruct-GGUF
cache-type-k = q8_0
cache-type-v = q8_0
INIEOF

# Add medium-tier models
if [[ "$TIER" =~ ^(medium|large|xl)$ ]]; then
cat >> "$LLAMA_DIR/models.ini" << 'INIEOF'

; ── Medium models ─────────────────────────────────────────────────────────────

[gemma3-4b]
hf-repo = ggml-org/gemma-3-4b-it-GGUF
cache-type-k = f16
cache-type-v = f16
parallel = 4
INIEOF
fi

# Add large-tier models
if [[ "$TIER" =~ ^(large|xl)$ ]]; then
cat >> "$LLAMA_DIR/models.ini" << 'INIEOF'

; ── Large models (32B) ────────────────────────────────────────────────────────

[qwen/qwen3-32b]
hf-repo = ggml-org/Qwen3-32B-GGUF:Q4_K_M
parallel = 4

[qwq-32b]
hf-repo = Qwen/QwQ-32B-GGUF:Q4_K_M

[gemma4-31b]
hf-repo = bartowski/google_gemma-4-31B-it-GGUF:Q4_K_M

[claude-sonnet-4-20250514]
hf-repo = ggml-org/Qwen3-32B-GGUF:Q4_K_M
parallel = 2
INIEOF
fi

# Add XL-tier models
if [ "$TIER" = "xl" ]; then
cat >> "$LLAMA_DIR/models.ini" << 'INIEOF'

; ── XL models (70B+) ─────────────────────────────────────────────────────────

[llama-3.3-70b-versatile]
hf-repo = bartowski/Llama-3.3-70B-Instruct-GGUF:Q4_K_M
parallel = 2

[qwen2.5-72b]
hf-repo = bartowski/Qwen2.5-72B-Instruct-GGUF:Q3_K_M
parallel = 2
INIEOF
fi

green "  models.ini written ✓"

# ── Install counsel ──────────────────────────────────────────────────────────
bold "Step 5: Installing sn_llama_counsel..."

COUNSEL_DIR="$HOME/sn_llama_counsel"
if [ -d "$COUNSEL_DIR/.git" ]; then
    echo "  Counsel already cloned, pulling latest..."
    cd "$COUNSEL_DIR"
    git pull origin main 2>&1 | tail -3
else
    echo "  Cloning counsel..."
    git clone https://github.com/SeKondBrainAILabs/sn_llama_counsel.git "$COUNSEL_DIR"
    cd "$COUNSEL_DIR"
fi

if [ ! -d "$COUNSEL_DIR/.venv" ]; then
    echo "  Creating virtualenv..."
    python3 -m venv .venv
fi

echo "  Installing counsel package..."
.venv/bin/pip install -e . 2>&1 | tail -3

if [ ! -x "$COUNSEL_DIR/.venv/bin/llama-counsel" ]; then
    red "Counsel install failed!"
    exit 1
fi

# Write config pointing to direct router
cat > "$COUNSEL_DIR/config.yaml" << 'CFGEOF'
# sn_llama_counsel configuration
api_base: http://localhost:11434
api_key: none
default_model: llama-3.1-8b-instant
CFGEOF
cp "$COUNSEL_DIR/config.yaml" "$COUNSEL_DIR/sn_llama_counsel/config.yaml"

green "  Counsel installed ✓"

# ── LaunchAgents ──────────────────────────────────────────────────────────────
bold "Step 6: Setting up auto-start on boot..."

LAUNCH_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_DIR"

# Router LaunchAgent
cat > "$LAUNCH_DIR/com.sachmans.llama-router.plist" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sachmans.llama-router</string>
  <key>ProgramArguments</key>
  <array>
    <string>${LLAMA_DIR}/build/bin/llama-server</string>
    <string>--models-preset</string>
    <string>${LLAMA_DIR}/models.ini</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>11434</string>
    <string>--models-max</string>
    <string>${MODELS_MAX}</string>
    <string>--metrics</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${HOME}/llama-router.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/llama-router.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
</dict>
</plist>
PLISTEOF

# Counsel LaunchAgent
cat > "$LAUNCH_DIR/com.sachmans.llama-counsel.plist" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sachmans.llama-counsel</string>
  <key>ProgramArguments</key>
  <array>
    <string>${COUNSEL_DIR}/.venv/bin/llama-counsel</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>5050</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${HOME}/llama-counsel.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/llama-counsel.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${COUNSEL_DIR}</string>
</dict>
</plist>
PLISTEOF

# Load the agents
launchctl unload "$LAUNCH_DIR/com.sachmans.llama-router.plist" 2>/dev/null || true
launchctl unload "$LAUNCH_DIR/com.sachmans.llama-counsel.plist" 2>/dev/null || true
launchctl load "$LAUNCH_DIR/com.sachmans.llama-router.plist"
launchctl load "$LAUNCH_DIR/com.sachmans.llama-counsel.plist"

green "  LaunchAgents installed ✓"

# ── Wait for startup ──────────────────────────────────────────────────────────
bold "Step 7: Verifying services..."

echo -n "  Waiting for router"
for i in $(seq 1 15); do
    if curl -s http://localhost:11434/health 2>/dev/null | grep -q ok; then
        echo " $(green 'ready!')"
        break
    fi
    echo -n "."
    sleep 2
done

echo -n "  Waiting for counsel"
for i in $(seq 1 15); do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5050 2>/dev/null | grep -q 200; then
        echo " $(green 'ready!')"
        break
    fi
    echo -n "."
    sleep 2
done

# ── Summary ───────────────────────────────────────────────────────────────────
LAN_IP=$(ifconfig en0 2>/dev/null | awk '/inet /{print $2}')

echo ""
bold "════════════════════════════════════════════════════════════"
bold "  Setup complete!"
bold "════════════════════════════════════════════════════════════"
echo ""
echo "  Services:"
echo "    Router:    http://localhost:11434    (OpenAI-compatible API)"
echo "    Counsel:   http://localhost:5050     (Advisory panel UI)"
if [ -n "$LAN_IP" ]; then
echo "    LAN:       http://$LAN_IP:5050"
fi
echo ""
echo "  Hardware tier: $TIER (${RAM_GB}GB RAM, models-max=$MODELS_MAX)"
echo "  Models:     $(ls ~/.cache/huggingface/hub/ 2>/dev/null | grep ^models | wc -l | tr -d ' ') cached"
echo ""
echo "  Manage:"
echo "    launchctl unload ~/Library/LaunchAgents/com.sachmans.llama-router.plist  # stop"
echo "    launchctl load   ~/Library/LaunchAgents/com.sachmans.llama-router.plist  # start"
echo "    tail -f ~/llama-router.log     # router logs"
echo "    tail -f ~/llama-counsel.log    # counsel logs"
echo ""
echo "  Test:"
echo '    curl http://localhost:11434/v1/chat/completions \'
echo '      -H "Content-Type: application/json" \'
echo '      -d '"'"'{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Hello!"}]}'"'"''
echo ""
bold "════════════════════════════════════════════════════════════"
