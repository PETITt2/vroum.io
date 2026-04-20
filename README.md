# Garage Social

Garage Social est un livrable web mobile-first pour suivre une ou plusieurs voitures avec:

- profils utilisateurs
- fiches vehicules
- trajets
- pleins et couts carburant
- entretiens
- observations
- visibilite `prive / abonnes / public`
- partage de vehicules entre plusieurs personnes
- suivi de profils et de vehicules

## Etat du livrable

Le projet est livre avec:

- une interface front prete a deployer
- un mode local immediat
- un CRUD complet en local: creation, edition, suppression
- une carte des trajets avec mise en evidence des routes les plus utilisees
- export et import JSON pour sauvegarde navigateur
- une configuration d'exemple `config.js`
- un schema Supabase `supabase-schema.sql`
- un schema PostgreSQL standard dans `db/`
- un script Linux de deploiement nginx
- un script de creation de base PostgreSQL
- un script de preparation Linux et un script de publication GitHub Pages

## Structure

- `index.html`: shell de l'application
- `styles.css`: design system et mise en page mobile-first
- `app.js`: logique front-end et stockage local
- `config.js`: configuration locale active
- `config.example.js`: exemple de configuration production
- `deploy-linux.sh`: deploiement Linux avec nginx
- `scripts/setup-linux-server.sh`: preparation serveur Linux puis appel du deploiement
- `scripts/deploy-github-pages.sh`: publication statique vers GitHub Pages
- `supabase-schema.sql`: schema SQL pour Supabase
- `db/001-postgres-schema.sql`: schema PostgreSQL standard
- `db/002-postgres-seed.sql`: donnees d'exemple pour PostgreSQL
- `scripts/create-postgres-db.sh`: creation de la base et chargement SQL
- `.env.example`: variables d'environnement de reference

## Lancer localement

Option la plus simple:

```powershell
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

Le site fonctionne aussi en ouvrant directement `index.html`, mais le serveur local est recommande.

Au premier lancement, l'application ne contient aucun compte precharge. Cree ton premier profil depuis le bouton `Connexion`.

Pour afficher un trajet sur la carte, ajoute une trace GPS optionnelle dans le formulaire trajet avec ce format:

```text
48.8566,2.3522 | 48.8606,2.3376 | 48.8667,2.3333
```

## Deploiement Linux

Preparation complete du serveur puis deploiement:

```bash
chmod +x scripts/setup-linux-server.sh
sudo bash scripts/setup-linux-server.sh /chemin/vers/webVoiture garage.example.com admin@example.com
```

Sans domaine:

```bash
sudo bash deploy-linux.sh
```

Avec domaine et SSL:

```bash
sudo bash deploy-linux.sh garage.example.com admin@example.com
```

Le script:

- desactive les anciennes sources `cdrom:` APT
- cree au besoin des depots Debian reseau
- installe `nginx`
- sauvegarde la version precedente
- copie le site dans `/var/www/garage-social`
- cree la configuration nginx
- active le site
- redemarre nginx
- ouvre le firewall `ufw` si present
- installe et configure `certbot` si domaine + email fournis

Si `nginx` ne demarre pas avec `bind() to 0.0.0.0:80 failed`, verifie quel processus utilise deja le port:

```bash
ss -ltnp | grep -E ':80|:443'
```

## Base de donnees PostgreSQL

Creation d'une base standard:

```bash
chmod +x scripts/create-postgres-db.sh
sudo bash scripts/create-postgres-db.sh garage_social garage_social motdepassefort
```

Le script:

- cree le role PostgreSQL
- cree la base
- applique `db/001-postgres-schema.sql`
- injecte `db/002-postgres-seed.sql`

## Base de donnees Supabase

Pour un backend collaboratif en ligne:

1. Creer un projet Supabase.
2. Executer `supabase-schema.sql`.
3. Activer l'authentification.
4. Renseigner `config.js` a partir de `config.example.js`.

## Configuration

Fichiers utiles:

- `config.js`: configuration utilisee par le front
- `config.example.js`: modele a dupliquer pour un autre environnement
- `.env.example`: reference pour l'infrastructure et les secrets

## Hebergement

Front statique compatible avec:

- nginx sur VPS Linux
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## Limites actuelles

Le front livre ici est pleinement exploitable en mode local avec stockage navigateur, edition, suppression, export et restauration JSON. Le schema SQL et la configuration production sont fournis pour brancher ensuite une persistance distante si tu veux aller vers un vrai backend collaboratif.

## GitHub Pages

Publication sur un depot GitHub deja initialise:

```bash
chmod +x scripts/deploy-github-pages.sh
bash scripts/deploy-github-pages.sh
```

Le script publie le site sur la branche `gh-pages`. Ensuite, active GitHub Pages dans les settings du depot avec la branche `gh-pages` et le dossier racine `/`.

## Suite recommandee

- brancher Supabase Auth et la persistance distante
- ajouter export CSV / PDF
- ajouter pieces jointes et factures
- ajouter alertes d'entretien et notifications
