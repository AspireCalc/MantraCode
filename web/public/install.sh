#!/usr/bin/env bash
set -euo pipefail

REPO="AspireCalc/MantraCode"
VERSION="${VERSION:-latest}"
BINARY_NAME="mantracode"

ORANGE='\033[38;5;208m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

printf "${ORANGE}"
printf ' __  __             _              ____          _      \n'
printf '|  \\/  | __ _ _ __ | |_ _ __ __ _ / ___|___   __| | ___ \n'
printf '| |\\/| |/ _` | '"'"'_ \\| __| '"'"'__/ _` | |   / _ \\ / _` |/ _ \\\n'
printf '| |  | | (_| | | | | |_| | | (_| | |__| (_) | (_| |  __/\n'
printf '|_|  |_|\\__,_|_| |_|\\__|_|  \\__,_|\\____\\___/ \\__,_|\\___|\n'
printf "${NC}\n"
printf "${BLUE}Installing MantraCode...${NC}\n"
printf "\n"

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
  printf "${ORANGE}Unsupported platform: %s %s${NC}\n" "$(uname -s)" "$(uname -m)"
  printf "Falling back to source installation...\n\n"
  if ! command -v bun &>/dev/null; then
    printf "Installing Bun...\n"
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
  TEMP_DIR="$(mktemp -d)"
  printf "Cloning repository...\n"
  git clone --depth 1 "https://github.com/${REPO}.git" "$TEMP_DIR"
  cd "$TEMP_DIR"
  DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bun install
  bun run build:cli
  bun link
  printf "${GREEN}MantraCode installed successfully via source!${NC}\n"
  exit 0
fi

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
if [[ ! -w "$INSTALL_DIR" ]]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

DOWNLOAD_DIR="$(mktemp -d)"
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

printf "${BLUE}Downloading MantraCode for %s/%s...${NC}\n" "$OS" "$ARCH"
printf "\n"

if command -v curl &>/dev/null; then
  HTTP_CODE="$(curl -sS -w '%{http_code}' -o "${DOWNLOAD_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL" 2>/dev/null)"
elif command -v wget &>/dev/null; then
  HTTP_CODE="$(wget -q -O "${DOWNLOAD_DIR}/${BINARY_NAME}" "$DOWNLOAD_URL" 2>/dev/null && echo "200" || echo "failed")"
else
  printf "${ORANGE}Neither curl nor wget found. Please install one of them.${NC}\n"
  exit 1
fi

if [[ "$HTTP_CODE" != "200" ]]; then
  printf "${ORANGE}Failed to download binary (HTTP %s).${NC}\n" "$HTTP_CODE"
  printf "The pre-built binary may not be available for your platform yet.\n"
  printf "Falling back to source installation...\n\n"
  if ! command -v bun &>/dev/null; then
    printf "Installing Bun...\n"
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi
  TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$DOWNLOAD_DIR" "$TEMP_DIR"' EXIT
  git clone --depth 1 "https://github.com/${REPO}.git" "$TEMP_DIR"
  cd "$TEMP_DIR"
  DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" bun install
  bun run build:cli
  bun link
  printf "${GREEN}MantraCode installed successfully via source!${NC}\n"
  exit 0
fi

chmod +x "${DOWNLOAD_DIR}/${BINARY_NAME}"
cp "${DOWNLOAD_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

if command -v "$BINARY_NAME" &>/dev/null; then
  printf "${GREEN}MantraCode installed successfully!${NC}\n\n"
  printf "Run ${ORANGE}mantracode${NC} in any project directory to start.\n"
else
  printf "${GREEN}MantraCode installed to %s/%s${NC}\n" "$INSTALL_DIR" "$BINARY_NAME"
  printf "\n"
  printf "Make sure %s is in your PATH, then run ${ORANGE}mantracode${NC}.\n" "$INSTALL_DIR"
  printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
fi
