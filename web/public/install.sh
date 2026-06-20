#!/usr/bin/env bash
set -euo pipefail

REPO="AspireCalc/MantraCode"
VERSION="${VERSION:-latest}"
BINARY_NAME="mantracode"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
ORANGE='\033[38;5;208m'
NC='\033[0m'

echo ""
echo -e "${ORANGE}  __  __                  __          ____          _${NC}"
echo -e "${ORANGE} |  \/  | __ _ _ __ __ _ / _| ___    / ___|___   __| | ___${NC}"
echo -e "${ORANGE} | |\/| |/ _\` | '__/ _\` | |_ / _ \  | |   / _ \ / _\` |/ _ \\${NC}"
echo -e "${ORANGE} | |  | | (_| | | | (_| |  _| (_) | | |__| (_) | (_| |  __/${NC}"
echo -e "${ORANGE} |_|  |_|\__,_|_|  \__,_|_|  \___/   \____\___/ \__,_|\___|${NC}"
echo ""
echo -e "${BLUE}Installing MantraCode...${NC}"
echo ""

detect_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "x86_64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "UNSUPPORTED:$arch" ;;
  esac
}

detect_os() {
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) echo "UNSUPPORTED:$os" ;;
  esac
}

OS="$(detect_os)"
ARCH="$(detect_arch)"
DOWNLOAD_URL="https://github.com/${REPO}/releases/${VERSION}/download/${BINARY_NAME}-${OS}-${ARCH}"

if [[ "$OS" == UNSUPPORTED:* ]] || [[ "$ARCH" == UNSUPPORTED:* ]]; then
  echo -e "${ORANGE}Unsupported platform: $(uname -s) $(uname -m)${NC}"
  echo "Falling back to source installation..."
  echo ""
  if ! command -v bun &>/dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
  TEMP_DIR="$(mktemp -d)"
  echo "Cloning repository..."
  git clone --depth 1 "https://github.com/${REPO}.git" "$TEMP_DIR"
  cd "$TEMP_DIR"
  bun install
  bun run build:cli
  bun link
  echo -e "${GREEN}MantraCode installed successfully via source!${NC}"
  exit 0
fi

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
if [[ ! -w "$INSTALL_DIR" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

DOWNLOAD_DIR="$(mktemp -d)"
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

echo -e "${BLUE}Downloading MantraCode for ${OS}/${ARCH}...${NC}"
echo ""

if command -v curl &>/dev/null; then
  HTTP_CODE="$(curl -sSfL -w '%{http_code}' -o "${DOWNLOAD_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL" 2>/dev/null || echo "failed")"
elif command -v wget &>/dev/null; then
  HTTP_CODE="$(wget -q -O "${DOWNLOAD_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL" 2>/dev/null && echo "200" || echo "failed")"
else
  echo -e "${ORANGE}Neither curl nor wget found. Please install one of them.${NC}"
  exit 1
fi

if [[ "$HTTP_CODE" != "200" ]] && [[ "$HTTP_CODE" != "206" ]]; then
  echo -e "${ORANGE}Failed to download binary (HTTP ${HTTP_CODE}).${NC}"
  echo "The pre-built binary may not be available for your platform yet."
  echo "Falling back to source installation..."
  echo ""
  if ! command -v bun &>/dev/null; then
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
  TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$DOWNLOAD_DIR" "$TEMP_DIR"' EXIT
  git clone --depth 1 "https://github.com/${REPO}.git" "$TEMP_DIR"
  cd "$TEMP_DIR"
  bun install
  bun run build:cli
  bun link
  echo -e "${GREEN}MantraCode installed successfully via source!${NC}"
  exit 0
fi

chmod +x "${DOWNLOAD_DIR}/${BINARY_NAME}"
cp "${DOWNLOAD_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

if command -v "$BINARY_NAME" &>/dev/null; then
  echo -e "${GREEN}MantraCode installed successfully!${NC}"
  echo ""
  echo -e "Run ${ORANGE}mantracode${NC} in any project directory to start."
else
  echo -e "${GREEN}MantraCode installed to ${INSTALL_DIR}/${BINARY_NAME}${NC}"
  echo ""
  echo -e "Make sure ${INSTALL_DIR} is in your PATH, then run ${ORANGE}mantracode${NC}."
  echo -e "  export PATH=\"${INSTALL_DIR}:\$PATH\""
fi
