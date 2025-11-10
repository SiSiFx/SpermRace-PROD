# 🚀 SPERMRACE.IO - WORKFLOW COMPLET

## 📁 Structure du projet

```
/opt/spermrace/                    ← 🎯 TOUJOURS TRAVAILLER ICI
├── packages/
│   ├── client/                    ← Frontend
│   │   ├── src/                   ← Code source
│   │   ├── dist/                  ← Build output
│   │   ├── style.css              ← Styles globaux
│   │   └── package.json
│   ├── server/                    ← Backend
│   └── shared/                    ← Code partagé
├── .vercel/                       ← Config Vercel
└── vercel.json                    ← Config déploiement
```

## 🔧 WORKFLOW STANDARD

### 1️⃣ Faire des modifications

```bash
cd /opt/spermrace

# Modifier les fichiers
# - packages/client/src/*.tsx
# - packages/client/style.css
# - packages/server/src/*.ts
```

### 2️⃣ Tester localement

```bash
# Frontend
cd /opt/spermrace/packages/client
npm run dev

# Backend
cd /opt/spermrace/packages/server
npm run dev
```

### 3️⃣ Build

```bash
cd /opt/spermrace/packages/client
npm run build
# Output: dist/
```

### 4️⃣ Déployer en production

```bash
cd /opt/spermrace
npx vercel --prod --yes
```

### 5️⃣ Assigner l'alias production

```bash
cd /opt/spermrace
npx vercel alias set <deployment-url> spermrace.io
```

## ⚠️ RÈGLES IMPORTANTES

### ✅ À FAIRE:
- ✅ Toujours travailler dans `/opt/spermrace`
- ✅ Build depuis `/opt/spermrace/packages/client`
- ✅ Deploy depuis `/opt/spermrace` (root du projet)
- ✅ Commit depuis `/opt/spermrace` si tu utilises git

### ❌ À NE PAS FAIRE:
- ❌ NE PAS travailler dans `/root/packages` (c'est un symlink)
- ❌ NE PAS copier manuellement des fichiers entre /root et /opt
- ❌ NE PAS build dans un endroit et deploy dans un autre

## 🔗 Symlink

`/root/packages` est un symlink vers `/opt/spermrace/packages`

Cela signifie:
- Les deux chemins pointent vers le MÊME emplacement
- Pas de risque de désynchronisation
- Peut utiliser `/root/packages` pour lire, mais préférer `/opt/spermrace`

## 📱 Déploiement Mobile (Safe-Area)

Les fixes iOS/Android sont dans `style.css`:
- `env(safe-area-inset-bottom)` pour iOS home indicator
- `calc()` pour espacements adaptés
- Media queries pour landscape/portrait

## 🎯 Checklist avant déploiement

- [ ] Build réussi sans erreurs
- [ ] Tester sur mobile (responsive)
- [ ] Vérifier les safe-areas (iOS/Android)
- [ ] Hard refresh après déploiement (Cmd+Shift+R)
- [ ] Tester sur vrai device si possible

## 🆘 En cas de problème

### "Les changements n'apparaissent pas"
```bash
# Hard refresh browser
Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows/Linux)

# Vérifier le déploiement
cd /opt/spermrace
npx vercel ls
```

### "Désynchronisation /root vs /opt"
```bash
# Vérifier si identiques
diff -q /root/packages/client/src/AppMobile.tsx /opt/spermrace/packages/client/src/AppMobile.tsx

# Si différents, le symlink est cassé
rm -rf /root/packages
ln -s /opt/spermrace/packages /root/packages
```

### "Build échoue"
```bash
cd /opt/spermrace/packages/client
rm -rf node_modules dist
npm install
npm run build
```

## 📞 Support

- Frontend URL: https://spermrace.io
- Vercel Dashboard: https://vercel.com/dashboard
- Project: spermrace-frontend

