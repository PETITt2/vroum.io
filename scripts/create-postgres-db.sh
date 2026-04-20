#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${1:-garage_social}"
DB_USER="${2:-garage_social}"
DB_PASSWORD="${3:-change-me-now}"
DB_HOST="${4:-localhost}"
DB_PORT="${5:-5432}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  printf "\n[postgres-setup] %s\n" "$1"
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

require_root_or_postgres() {
  if [[ "${EUID}" -ne 0 ]] && [[ "$(id -un)" != "postgres" ]]; then
    echo "Lance ce script en root ou avec l'utilisateur postgres."
    exit 1
  fi
}

ensure_postgres_installed() {
  if command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
    return
  fi

  if [[ "${EUID}" -ne 0 ]]; then
    echo "PostgreSQL n'est pas installe ou l'utilisateur systeme postgres est absent. Relance ce script en root pour l'installation automatique."
    exit 1
  fi

  log "Installation de PostgreSQL"
  case "$(detect_pkg_manager)" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y postgresql postgresql-client
      ;;
    dnf)
      dnf install -y postgresql-server postgresql
      ;;
    yum)
      yum install -y postgresql-server postgresql
      ;;
    *)
      echo "Gestionnaire de paquets non supporte. Installe PostgreSQL manuellement."
      exit 1
      ;;
  esac
}

ensure_postgres_service() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable postgresql >/dev/null 2>&1 || true
    systemctl start postgresql >/dev/null 2>&1 || true
  fi
}

run_as_postgres() {
  if [[ "$(id -un)" == "postgres" ]]; then
    "$@"
    return
  fi

  if command -v runuser >/dev/null 2>&1; then
    runuser -u postgres -- "$@"
    return
  fi

  su -s /bin/sh postgres -c "$(printf '%q ' "$@")"
}

run_psql() {
  local sql="$1"
  run_as_postgres psql -v ON_ERROR_STOP=1 -d postgres -c "$sql"
}

run_file() {
  local file="$1"
  PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
}

database_exists() {
  run_as_postgres psql -tAc "select 1 from pg_database where datname='${DB_NAME}'" postgres | grep -q 1
}

require_root_or_postgres
ensure_postgres_installed
ensure_postgres_service

log "Creation du role PostgreSQL si necessaire"
run_psql "do \$\$ begin if not exists (select 1 from pg_roles where rolname = '${DB_USER}') then create role ${DB_USER} login password '${DB_PASSWORD}'; end if; end \$\$;"

log "Creation de la base si necessaire"
if ! database_exists; then
  run_as_postgres createdb -O "$DB_USER" "$DB_NAME"
fi

log "Application du schema"
run_file "${ROOT_DIR}/db/001-postgres-schema.sql"

log "Injection du seed de demonstration"
run_file "${ROOT_DIR}/db/002-postgres-seed.sql"

log "Base prete"
echo "Base : ${DB_NAME}"
echo "Utilisateur : ${DB_USER}"
echo "Host : ${DB_HOST}:${DB_PORT}"
