#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-gh-pages}"
REMOTE_NAME="${2:-origin}"
BUILD_DIR="${ROOT_DIR}/.deploy/github-pages"

log() {
  printf "\n[deploy-github-pages] %s\n" "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Commande requise absente: $1"
    exit 1
  fi
}

require_command git

if [[ ! -d "${ROOT_DIR}/.git" ]]; then
  echo "Ce dossier n'est pas un depot git. Lance d'abord 'git init' puis configure un remote GitHub."
  exit 1
fi

if ! git -C "${ROOT_DIR}" remote get-url "${REMOTE_NAME}" >/dev/null 2>&1; then
  echo "Remote git '${REMOTE_NAME}' introuvable. Configure ton depot GitHub puis relance."
  exit 1
fi

log "Preparation du dossier de publication"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

cp "${ROOT_DIR}/index.html" "${BUILD_DIR}/index.html"
cp "${ROOT_DIR}/styles.css" "${BUILD_DIR}/styles.css"
cp "${ROOT_DIR}/app.js" "${BUILD_DIR}/app.js"

if [[ -f "${ROOT_DIR}/config.js" ]]; then
  cp "${ROOT_DIR}/config.js" "${BUILD_DIR}/config.js"
else
  cp "${ROOT_DIR}/config.example.js" "${BUILD_DIR}/config.js"
fi

touch "${BUILD_DIR}/.nojekyll"

log "Publication sur ${REMOTE_NAME}/${BRANCH}"
git -C "${BUILD_DIR}" init >/dev/null
git -C "${BUILD_DIR}" checkout -b "${BRANCH}" >/dev/null
git -C "${BUILD_DIR}" add .
git -C "${BUILD_DIR}" commit -m "Deploy Garage Social" >/dev/null
git -C "${BUILD_DIR}" remote add "${REMOTE_NAME}" "$(git -C "${ROOT_DIR}" remote get-url "${REMOTE_NAME}")"
git -C "${BUILD_DIR}" push --force "${REMOTE_NAME}" "${BRANCH}"

log "Deployment termine"
echo "Active GitHub Pages dans les settings du depot avec la branche '${BRANCH}' et la racine '/'."
