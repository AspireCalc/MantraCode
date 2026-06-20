#!/usr/bin/env bash
set -euo pipefail

REPO="AspireCalc/MantraCode"
NPM_PACKAGE="@aspirenx/mantracode"
VERSION="${VERSION:-latest}"

ORANGE='\033[38;5;208m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

# ──────────────────────────────────────────────
# Methods (defined first, tried in order below)
# ──────────────────────────────────────────────

# Method A: Source install (last resort)
source_install() {
  local reason="$1"
  printf "${ORANGE}${reason}${NC}\n"
  printf "Falling back to source installation...\n\n"

  if ! command -v bun &>/dev/null; then
    printf "Installing Bun...\n"
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi

  local tmpdir
  tmpdir="$(mktemp -d)"
  printf "Cloning repository...\n"
  git clone --depth 1 "https://github.com/${REPO}.git" "$tmpdir"
  cd "$tmpdir"
  DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bun install
  bun run build:cli
  bun link
  printf "${GREEN}MantraCode installed successfully via source!${NC}\n"
  exit 0
}

# Method B: npm global install
npm_install() {
  if ! command -v npm &>/dev/null && ! command -v bun &>/dev/null; then
    return 1
  fi

  printf "${BLUE}Installing via npm...${NC}\n"

  local installer="npm"
  if command -v bun &>/dev/null; then
    installer="bun"
  fi

  # Check if the package exists on the registry before attempting install
  if ! npm view "$NPM_PACKAGE" version &>/dev/null; then
    printf "${ORANGE}Package ${NPM_PACKAGE} not found on npm.${NC}\n"
    return 1
  fi

  if $installer install -g "$NPM_PACKAGE" 2>/dev/null; then
    printf "${GREEN}MantraCode installed successfully via npm!${NC}\n\n"
    printf "Run ${ORANGE}mantracode${NC} in any project directory to start.\n"
    exit 0
  fi

  return 1
}

# Method C: Binary download from GitHub Releases
binary_install() {
  if [[ "$OS" == "windows" ]]; then
    REMOTE_BINARY="mantracode-${OS}-${ARCH}.exe"
    LOCAL_NAME="mantracode.exe"
  else
    REMOTE_BINARY="mantracode-${OS}-${ARCH}"
    LOCAL_NAME="mantracode"
  fi

  local url="https://github.com/${REPO}/releases/download/${VERSION}/${REMOTE_BINARY}"
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  printf "${BLUE}Downloading MantraCode for %s/%s...${NC}\n" "$OS" "$ARCH"

  local http_code
  if command -v curl &>/dev/null; then
    http_code="$(curl -sSL -w '%{http_code}' -o "${tmpdir}/${LOCAL_NAME}" "$url" 2>/dev/null)"
  elif command -v wget &>/dev/null; then
    http_code="$(wget -q -O "${tmpdir}/${LOCAL_NAME}" "$url" 2>/dev/null && echo "200" || echo "failed")"
  else
    trap - EXIT
    return 1
  fi

  if [[ "$http_code" != "200" ]]; then
    trap - EXIT
    return 1
  fi

  local install_dir="${INSTALL_DIR:-/usr/local/bin}"
  if [[ ! -w "$install_dir" ]]; then
    install_dir="$HOME/.local/bin"
    mkdir -p "$install_dir"
  fi

  chmod +x "${tmpdir}/${LOCAL_NAME}"
  cp "${tmpdir}/${LOCAL_NAME}" "${install_dir}/${LOCAL_NAME}"

  if command -v "$LOCAL_NAME" &>/dev/null; then
    printf "${GREEN}MantraCode installed successfully!${NC}\n\n"
    printf "Run ${ORANGE}mantracode${NC} in any project directory to start.\n"
  else
    printf "${GREEN}MantraCode installed to %s/%s${NC}\n" "$install_dir" "$LOCAL_NAME"
    printf "\n"
    printf "Make sure %s is in your PATH, then run ${ORANGE}mantracode${NC}.\n" "$install_dir"
    if [[ "$OS" != "windows" ]]; then
      printf "  export PATH=\"%s:\$PATH\"\n" "$install_dir"
    fi
  fi
  exit 0
}

# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

printf "${ORANGE}"
printf ' __  __             _              ____          _      \n'
printf '|  \\/  | __ _ _ __ | |_ _ __ __ _ / ___|___   __| | ___ \n'
printf '| |\\/| |/ _` | '"'"'_ \\| __| '"'"'__/ _` | |   / _ \\ / _` |/ _ \\\n'
printf '| |  | | (_| | | | | |_| | | (_| | |__| (_) | (_| |  __/\n'
printf '|_|  |_|\\__,_|_| |_|\\__|_|  \\__,_|\\____\\___/ \\__,_|\\___|\n'
printf "${NC}\n"
printf "${BLUE}Installing MantraCode...${NC}\n"
printf "\n"

detect_os() {
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin)  echo "darwin" ;;
    Linux)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)       echo "UNSUPPORTED:$os" ;;
  esac
}

detect_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "x86_64" ;;
    aarch64|arm64) echo "arm64" ;;
    *)            echo "UNSUPPORTED:$arch" ;;
  esac
}

OS="$(detect_os)"
ARCH="$(detect_arch)"

if [[ "$OS" == "windows" ]]; then
  printf "Tip: Windows users can also use the PowerShell installer:\n"
  printf "  irm https://mantracode.vercel.app/install.ps1 | iex\n\n"
fi

# If OS or arch is unsupported, go straight to source install
if [[ "$OS" == UNSUPPORTED:* ]]; then
  source_install "Unsupported OS: $(uname -s)"
fi
if [[ "$ARCH" == UNSUPPORTED:* ]]; then
  source_install "Unsupported architecture: $(uname -m)"
fi

# Try methods in order: binary → npm → source
binary_install || npm_install || source_install "Could not download pre-built binary. Trying alternative methods..."
