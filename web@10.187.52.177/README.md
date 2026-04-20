# Garage Social

Application web mobile-first pour suivre plusieurs voitures:

- trajets
- pleins et consommation
- entretiens
- observations
- profils utilisateurs
- suivi de profils et de voitures
- public / prive / abonnes
- partage de vehicules entre plusieurs personnes

## Lancer localement

Le projet est 100% statique. Tu peux ouvrir `index.html` directement dans un navigateur.

Option serveur local:

```powershell
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Fichiers

- `index.html`: structure de l'application
- `styles.css`: design mobile-first
- `app.js`: logique front-end et mode demo local avec `localStorage`
- `supabase-schema.sql`: base de donnees et politiques RLS pour le mode collaboratif

## Hebergement gratuit

Compatible avec:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## Passer au collaboratif reel

1. Creer un projet Supabase gratuit.
2. Executer `supabase-schema.sql`.
3. Activer Supabase Auth.
4. Remplacer le stockage local par l'API Supabase dans `app.js`.
5. Deployer le site statique.

## Suite recommandee

- ajouter edition et suppression
- ajouter photos, factures et documents
- ajouter export CSV ou PDF
- ajouter notifications d'entretien
- ajouter synchronisation temps reel
