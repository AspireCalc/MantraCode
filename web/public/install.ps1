#!/usr/bin/env pwsh
$Repo = "AspireCalc/MantraCode"
$Version = if ($env:VERSION) { $env:VERSION } else { "latest" }

function Write-Color($Text, $Color) {
  Write-Host $Text -ForegroundColor $Color
}

Write-Color " __  __             _              ____          _      " "DarkYellow"
Write-Color "|  \/  | __ _ _ __ | |_ _ __ __ _ / ___|___   __| | ___ " "DarkYellow"
Write-Color "| |\/| |/ _` | '_ \| __| '__/ _` | |   / _ \ / _` |/ _ \" "DarkYellow"
Write-Color "| |  | | (_| | | | | |_| | | (_| | |__| (_) | (_| |  __/" "DarkYellow"
Write-Color "|_|  |_|\__,_|_| |_|\__|_|  \__,_|\____\___/ \__,_|\___|" "DarkYellow"
Write-Host ""
Write-Color "Installing MantraCode..." "Blue"
Write-Host ""

# Detect architecture
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "x86" }

# Determine download URL
$BinaryName = "mantracode-windows-x64.exe"
$DownloadUrl = "https://github.com/$Repo/releases/$Version/download/$BinaryName"

$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$HOME\.local\bin" }
$InstallPath = Join-Path $InstallDir "mantracode.exe"

Write-Color "Downloading MantraCode for windows/x64..." "Blue"
Write-Host ""

# Download
try {
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri $DownloadUrl -OutFile "$env:TEMP\mantracode.exe" -ErrorAction Stop
} catch {
  Write-Color "Failed to download binary: $_" "Red"
  Write-Host "Falling back to source installation..."
  Write-Host ""

  # Check for Bun
  if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Color "Installing Bun..." "Blue"
    $bunScript = Invoke-WebRequest -Uri "https://bun.sh/install" -UseBasicParsing
    Invoke-Expression $bunScript
    $env:Path = "$HOME\.bun\bin;$env:Path"
  }

  $tmpDir = Join-Path $env:TEMP "mantracode-install-$(Get-Random)"
  New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
  try {
    Push-Location $tmpDir
    git clone --depth 1 "https://github.com/$Repo.git" .
    $env:DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy"
    bun install
    bun run build:cli
    bun link
    Write-Color "MantraCode installed successfully via source!" "Green"
  } finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
  }
  return
}

# Install
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Move-Item -Force "$env:TEMP\mantracode.exe" $InstallPath

if (Get-Command mantracode -ErrorAction SilentlyContinue) {
  Write-Color "MantraCode installed successfully!" "Green"
  Write-Host ""
  Write-Host "Run mantracode in any project directory to start."
} else {
  Write-Color "MantraCode installed to $InstallPath" "Green"
  Write-Host ""
  Write-Host "Make sure $InstallDir is in your PATH, then run mantracode."
  Write-Host "  `$env:Path += `";$InstallDir`""
}
