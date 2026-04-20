#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOMAIN="${2:-_}"
EMAIL="${3:-}"

log() {
  printf "\n[setup-linux-server] %s\n" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Ce script doit etre lance avec sudo ou en root."
    exit 1
  fi
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo "apt"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    echo "dnf"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    echo "yum"
    return
  fi
  echo "unsupported"
}

install_base_packages() {
  local manager
  manager="$(detect_pkg_manager)"

  case "$manager" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y bash ca-certificates curl git unzip
      ;;
    dnf)
      dnf install -y bash ca-certificates curl git unzip
      ;;
    yum)
      yum install -y epel-release || true
      yum install -y bash ca-certificates curl git unzip
      ;;
    *)
      echo "Gestionnaire de paquets non supporte."
      exit 1
      ;;
  esac
}

require_root

if [[ ! -f "${PROJECT_DIR}/deploy-linux.sh" ]]; then
  echo "deploy-linux.sh introuvable dans ${PROJECT_DIR}"
  exit 1
fi

log "Installation des paquets de base"
install_base_packages

log "Droits d'execution sur les scripts"
chmod +x "${PROJECT_DIR}/deploy-linux.sh"
chmod +x "${PROJECT_DIR}/scripts/create-postgres-db.sh" 2>/dev/null || true

log "Deploiement de l'application"
bash "${PROJECT_DIR}/deploy-linux.sh" "${DOMAIN}" "${EMAIL}"

log "Termine"
echo "Projet source : ${PROJECT_DIR}"
