#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" == "Darwin" ]]; then
  command -v brew >/dev/null 2>&1 || {
    echo "macOS 安装需要 Homebrew: https://brew.sh" >&2
    exit 1
  }
  brew install openjdk@11
  brew install --cask libreoffice
elif command -v apt-get >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    APT=(apt-get)
  elif command -v sudo >/dev/null 2>&1; then
    APT=(sudo apt-get)
  else
    echo "安装系统依赖需要 root 或 sudo 权限" >&2
    exit 1
  fi
  "${APT[@]}" update
  DEBIAN_FRONTEND=noninteractive "${APT[@]}" install -y \
    default-jre-headless \
    fonts-noto-cjk \
    libreoffice-calc \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    python3
else
  echo "当前系统不支持自动安装，请手工安装 JDK 8/11、Python 3 与 LibreOffice 7+" >&2
  exit 1
fi

echo "Java:"
java -version
echo "LibreOffice:"
if command -v soffice >/dev/null 2>&1; then
  soffice --version
else
  /Applications/LibreOffice.app/Contents/MacOS/soffice --version
fi
