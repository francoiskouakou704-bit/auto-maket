# Auto-Maket

[![Test & Coverage](https://github.com/francoiskouakou704-bit/auto-maket/actions/workflows/test.yml/badge.svg)](https://github.com/francoiskouakou704-bit/auto-maket/actions/workflows/test.yml)

Plateforme de marketplace automobile construite avec TanStack Start, React 19, TypeScript et Bun.

## Tests & Couverture

Le workflow CI génère un rapport de couverture détaillé visible dans le **GitHub Actions Step Summary** de chaque exécution. Le rapport HTML est aussi conservé comme artefact pendant 14 jours.

Pour exécuter les tests en local :

```bash
bun install
bun run test           # tests seuls
bun run test:coverage  # tests + couverture
```

Le badge de couverture Shields.io peut être ajouté en connectant le projet à [Codecov](https://about.codecov.io/) ou en configurant un Gist GitHub avec `Schneegans/dynamic-badges-action` dans le workflow CI.
