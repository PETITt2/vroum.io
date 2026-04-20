#!/usr/bin/env bash
set -euo pipefail

APP_NAME="garage-social"
APP_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"
DEFAULT_DOMAIN="_"
DOMAIN="${1:-$DEFAULT_DOMAIN}"
EMAIL="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf "\n[%s] %s\n" "$APP_NAME" "$1"
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

cleanup_invalid_apt_backup_files() {
  local sources_dir="/etc/apt/sources.list.d"
  [[ -d "$sources_dir" ]] || return

  find "$sources_dir" -maxdepth 1 -type f \( -name "*.bak-*" -o -name "*.sources.bak*" -o -name "*.list.bak*" \) | while read -r file; do
    local target="/var/backups/${APP_NAME}/apt-sources/legacy-$(basename "$file")"
    mkdir -p "/var/backups/${APP_NAME}/apt-sources"
    mv "$file" "$target"
    log "Ancienne sauvegarde APT deplacee: $(basename "$file")"
  done
}

stop_conflicting_web_servers() {
  local service

  for service in apache2 httpd; do
    if systemctl list-unit-files "${service}.service" >/dev/null 2>&1; then
      if systemctl is-active --quiet "$service"; then
        log "Arret du service ${service} pour liberer le port 80"
        systemctl stop "$service"
      fi

      if systemctl is-enabled --quiet "$service" >/dev/null 2>&1; then
        log "Desactivation du service ${service} pour eviter un conflit au redemarrage"
        systemctl disable "$service" >/dev/null 2>&1 || true
      fi
    fi
  done
}

install_packages() {
  local manager
  manager="$(detect_pkg_manager)"

  case "$manager" in
    apt)
      cleanup_invalid_apt_backup_files
      disable_apt_cdrom_sources
      ensure_apt_network_sources
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y nginx curl
      ;;
    dnf)
      dnf install -y nginx curl
      ;;
    yum)
      yum install -y epel-release || true
      yum install -y nginx curl
      ;;
    *)
      echo "Gestionnaire de paquets non supporte. Installe nginx et curl manuellement."
      exit 1
      ;;
  esac
}

disable_apt_cdrom_sources() {
  log "Desactivation des sources APT cdrom si presentes"
  local apt_backup_dir="/var/backups/${APP_NAME}/apt-sources"
  mkdir -p "$apt_backup_dir"

  if [[ -f /etc/apt/sources.list ]]; then
    cp /etc/apt/sources.list "${apt_backup_dir}/sources.list.$(date +%Y%m%d%H%M%S).bak"
    sed -i '/^[[:space:]]*deb[[:space:]]\+cdrom:/ s/^/# disabled by deploy-linux.sh /' /etc/apt/sources.list
  fi

  if [[ -d /etc/apt/sources.list.d ]]; then
    find /etc/apt/sources.list.d -maxdepth 1 -type f \( -name "*.list" -o -name "*.sources" \) | while read -r file; do
      cp "$file" "${apt_backup_dir}/$(basename "$file").$(date +%Y%m%d%H%M%S).bak"
      sed -i '/^[[:space:]]*deb[[:space:]]\+cdrom:/ s/^/# disabled by deploy-linux.sh /' "$file"
      sed -i '/^[[:space:]]*URIs:[[:space:]]*cdrom:/ s/^/# disabled by deploy-linux.sh /' "$file"
    done
  fi
}

ensure_apt_network_sources() {
  log "Verification des sources APT reseau"

  if has_working_apt_network_sources; then
    log "Sources APT reseau detectees"
    return
  fi

  log "Aucune source APT reseau detectee, creation d'une configuration Debian par defaut"

  local codename
  codename="$(get_debian_codename)"

  mkdir -p /etc/apt/sources.list.d
  cat > /etc/apt/sources.list.d/debian.sources <<EOF
Types: deb
URIs: http://deb.debian.org/debian
Suites: ${codename} ${codename}-updates
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: http://security.debian.org/debian-security
Suites: ${codename}-security
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
EOF
}

has_working_apt_network_sources() {
  if grep -RqsE '^[[:space:]]*deb[[:space:]]+https?://' /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null; then
    return 0
  fi

  if grep -RqsE '^[[:space:]]*URIs:[[:space:]]*https?://' /etc/apt/sources.list.d /etc/apt/sources.list 2>/dev/null; then
    return 0
  fi

  return 1
}

get_debian_codename() {
  if [[ -r /etc/os-release ]]; then
    . /etc/os-release
    if [[ -n "${VERSION_CODENAME:-}" ]]; then
      echo "$VERSION_CODENAME"
      return
    fi
  fi

  if command -v lsb_release >/dev/null 2>&1; then
    lsb_release -sc
    return
  fi

  echo "trixie"
}

install_certbot() {
  local manager
  manager="$(detect_pkg_manager)"

  case "$manager" in
    apt)
      apt-get install -y certbot python3-certbot-nginx
      ;;
    dnf)
      dnf install -y certbot python3-certbot-nginx
      ;;
    yum)
      yum install -y certbot python3-certbot-nginx
      ;;
  esac
}

copy_site_files() {
  log "Copie du site dans ${APP_DIR}"
  backup_existing_release
  mkdir -p "$APP_DIR"
  install -m 0644 "${SCRIPT_DIR}/index.html" "${APP_DIR}/index.html"
  install -m 0644 "${SCRIPT_DIR}/styles.css" "${APP_DIR}/styles.css"
  install -m 0644 "${SCRIPT_DIR}/app.js" "${APP_DIR}/app.js"
  if [[ -f "${SCRIPT_DIR}/config.example.js" ]] && [[ ! -f "${APP_DIR}/config.js" ]]; then
    install -m 0644 "${SCRIPT_DIR}/config.example.js" "${APP_DIR}/config.js"
  fi
  chown -R "$(detect_web_user)":"$(detect_web_group)" "$APP_DIR" 2>/dev/null || true
}

backup_existing_release() {
  if [[ ! -d "$APP_DIR" ]]; then
    return
  fi

  mkdir -p "$BACKUP_DIR"
  local stamp
  stamp="$(date +%Y%m%d%H%M%S)"
  log "Sauvegarde de la version precedente dans ${BACKUP_DIR}/${stamp}"
  cp -a "$APP_DIR" "${BACKUP_DIR}/${stamp}"
}

detect_web_user() {
  if id -u www-data >/dev/null 2>&1; then
    echo "www-data"
    return
  fi
  if id -u nginx >/dev/null 2>&1; then
    echo "nginx"
    return
  fi
  echo "root"
}

detect_web_group() {
  if getent group www-data >/dev/null 2>&1; then
    echo "www-data"
    return
  fi
  if getent group nginx >/dev/null 2>&1; then
    echo "nginx"
    return
  fi
  echo "root"
}

write_nginx_config() {
  log "Creation de la configuration nginx"
  cat > "$NGINX_AVAILABLE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    root ${APP_DIR};
    index index.html;

    access_log /var/log/nginx/${APP_NAME}.access.log;
    error_log /var/log/nginx/${APP_NAME}.error.log;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location = /app.js {
        add_header Cache-Control "no-cache";
    }

    location = /styles.css {
        add_header Cache-Control "no-cache";
    }

    location = /config.js {
        add_header Cache-Control "no-cache";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
EOF

  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  rm -f /etc/nginx/sites-enabled/default
}

start_nginx() {
  log "Verification et redemarrage nginx"
  stop_conflicting_web_servers
  nginx -t
  systemctl enable nginx
  if ! systemctl restart nginx; then
    log "Echec du redemarrage nginx, affichage du diagnostic"
    if command -v ss >/dev/null 2>&1; then
      log "Processus utilisant les ports 80 ou 443"
      ss -ltnp | grep -E ':80|:443' || true
    fi
    systemctl status nginx --no-pager -l || true
    journalctl -xeu nginx --no-pager || true
    exit 1
  fi
}

configure_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    log "Ouverture du firewall pour nginx"
    ufw allow 'Nginx Full' || true
  fi
}

configure_ssl() {
  if [[ "$DOMAIN" == "$DEFAULT_DOMAIN" || -z "$EMAIL" ]]; then
    log "SSL ignore: passe un domaine et un email pour activer Let's Encrypt"
    return
  fi

  log "Installation de certbot"
  install_certbot

  log "Activation du certificat SSL pour ${DOMAIN}"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
}

show_summary() {
  log "Deploiement termine"
  echo "Dossier web : ${APP_DIR}"
  echo "Config nginx : ${NGINX_AVAILABLE}"
  if [[ "$DOMAIN" == "$DEFAULT_DOMAIN" ]]; then
    echo "Acces : http://IP_DU_SERVEUR/"
  else
    echo "Acces : http://${DOMAIN}/"
  fi
}

require_root
install_packages
copy_site_files
write_nginx_config
start_nginx
configure_firewall
configure_ssl
show_summary
