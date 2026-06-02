const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
        PageBreak, ExternalHyperlink, LevelFormat } = require("docx");
const fs = require("fs");

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial" })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial" })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial" })]
  });
}

function p(text, opts = {}) {
  const runs = [];
  if (opts.bold) runs.push(new TextRun({ text, size: 24, font: "Arial", bold: true }));
  else runs.push(new TextRun({ text, size: 24, font: "Arial" }));
  return new Paragraph({ children: runs, spacing: { after: 120 } });
}

function codeBlock(lines) {
  const runs = lines.map((line, i) =>
    new TextRun({ text: line, size: 20, font: "Courier New" })
  );
  return new Paragraph({
    children: runs,
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    spacing: { before: 120, after: 120 }
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 160, after: 160 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Rapport 1 – Analyse des GitHub Actions", bold: true, size: 36, font: "Arial" })],
        spacing: { after: 240 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Dépôt analysé : auto-maket (francoiskouakou704-bit)", size: 24, font: "Arial" })],
        spacing: { after: 120 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Date : 2 juin 2026", size: 24, font: "Arial" })],
        spacing: { after: 480 }
      }),

      h1("1. Introduction"),
      p("Le présent rapport porte sur l'analyse des workflows GitHub Actions du dépôt auto-maket, appartenant à l'utilisateur francoiskouakou704-bit sur GitHub. L'URL analysée est https://github.com/francoiskouakou704-bit/auto-maket.git."),
      p("L'objectif de cette analyse est d'inventorier les fichiers de workflow présents dans le répertoire .github/workflows/, d'en décrire la structure et la logique, d'évaluer leur qualité et leur sécurité, et de formuler des recommandations d'amélioration."),

      h1("2. Inventaire des workflows identifiés"),
      p("Une inspection complète du dépôt cloné a été réalisée. Voici le résultat :", { bold: true }),
      new Paragraph({ children: [new TextRun({ text: "Le répertoire .github/workflows/ n'existe pas dans ce dépôt.", bold: true, size: 24, font: "Arial", color: "C00000" })], spacing: { after: 240 } }),
      p("Par conséquent, aucun fichier de workflow YAML n'a été détecté. Le projet ne dispose actuellement d'aucune intégration continue (CI) ni de déploiement continu (CD) via GitHub Actions."),

      new Table({
        width: { size: 9066, type: WidthType.DXA },
        columnWidths: [4533, 4533],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorders, width: { size: 4533, type: WidthType.DXA },
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Élément", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders: cellBorders, width: { size: 4533, type: WidthType.DXA },
                shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Statut", bold: true, size: 22, font: "Arial" })] })]
              }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Répertoire .github/", size: 22, font: "Arial" })] })] }),
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Absent", size: 22, font: "Arial", color: "C00000" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Répertoire .github/workflows/", size: 22, font: "Arial" })] })] }),
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Absent", size: 22, font: "Arial", color: "C00000" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Fichiers .yml / .yaml de workflow", size: 22, font: "Arial" })] })] }),
              new TableCell({ borders: cellBorders, width: { size: 4533, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Aucun", size: 22, font: "Arial", color: "C00000" })] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({ children: [], spacing: { after: 240 } }),

      h1("3. Structure et logique des workflows"),
      p("En l'absence totale de workflows GitHub Actions, cette section ne peut décrire aucune structure de fichier YAML, aucun déclencheur (on:, push, pull_request, schedule), aucune matrice de jobs (strategy: matrix), ni aucune étape de pipeline (steps:)."),
      p("L'analyse de la logique métier des workflows est donc impossible. Cette section reste vide pour le moment, dans l'attente de la création future de workflows."),

      h1("4. Évaluation de la qualité et de la sécurité"),

      h2("4.1 Qualité des workflows"),
      p("Indicateur de qualité non applicable : le score de qualité est de 0/10, non pas en raison d'une mauvaise qualité, mais en raison de l'absence totale de workflows à évaluer."),
      p("Les critères d'évaluation suivants n'ont pas pu être mesurés :"),
      p("- Lisibilité et clarté du code YAML (indentation, noms des jobs et des steps)"),
      p("- Réutilisabilité (utilisation de composite actions ou de workflows réutilisables)"),
      p("- Couverture (exécution sur toutes les branches pertinentes)"),
      p("- Gestion des erreurs (continue-on-error, if: failure())"),

      h2("4.2 Sécurité des workflows"),
      p("Indicateur de sécurité non applicable : le score de sécurité est de 0/10 pour la même raison d'absence."),
      p("Les critères de sécurité suivants n'ont pas pu être vérifiés :"),
      p("- Gestion des secrets (utilisation de secrets GitHub via ${{ secrets.XXX }})"),
      p("- Moindre privilège (permissions: read-only ou write limité)"),
      p("- Validation des entrées (filtre sur les branches, vérification des PR)"),
      p("- Utilisation de versions pinnées des actions (actions/checkout@v4.1.1 plutôt que @v4)"),
      p("- Absence de tokens exposés en dur dans les fichiers YAML"),

      h1("5. Recommandations"),
      p("Sur la base de l'analyse du projet (stack technique identifiée : TanStack Start, React 19, TypeScript, Vite, Bun, Supabase, Tailwind CSS, ESLint, Prettier), voici les workflows GitHub Actions recommandés :"),

      h2("5.1 Workflow CI – Build et Tests"),
      p("Un workflow à exécuter sur chaque pull request et push vers main, effectuant le lint, le format check, le type check TypeScript et le build."),
      codeBlock([
        "name: CI",
        "on: [push, pull_request]",
        "jobs:",
        "  build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: oven-sh/setup-bun@v2",
        "      - run: bun install",
        "      - run: bun run lint",
        "      - run: bun run build"
      ]),

      h2("5.2 Workflow CD – Déploiement automatique"),
      p("Un workflow de déploiement continu vers l'environnement de production (Lovable Cloud / Vercel / autre) déclenché sur push vers main."),
      codeBlock([
        "name: Deploy",
        "on:",
        "  push:",
        "    branches: [main]",
        "jobs:",
        "  deploy:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: echo 'Déployer vers Lovable Cloud'"
      ]),

      h2("5.3 Workflow de sécurité – Dependabot et scan"),
      p("Activation de Dependabot pour les mises à jour automatiques des dépendances, et ajout d'un workflow de scan de vulnérabilités (npm audit / bun audit)."),
      codeBlock([
        "name: Security Audit",
        "on: [pull_request, workflow_dispatch]",
        "jobs:",
        "  audit:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: oven-sh/setup-bun@v2",
        "      - run: bun install",
        "      - run: bun audit"
      ]),

      h1("6. Conclusion"),
      p("L'analyse du dépôt auto-maket révèle une absence totale de workflows GitHub Actions. Aucun fichier YAML n'a été trouvé dans .github/workflows/, ce qui signifie que le projet n'est actuellement couvert par aucune intégration continue, aucun déploiement continu, ni aucune automatisation de vérification de qualité ou de sécurité."),
      p("Cette situation présente des risques opérationnels : absence de validation automatique du code avant fusion, déploiement manuel potentiellement sujet aux erreurs, et détection tardive des vulnérabilités de dépendances."),
      p("L'appréciation globale est que l'utilisation des GitHub Actions dans ce projet est inexistante. La mise en place des workflows recommandés ci-dessus (CI, CD, sécurité) constituerait une amélioration significative de la maturité DevOps du projet et garantirait une meilleure fiabilité du livrable."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/mnt/documents/rapport_analyse_github_actions.docx", buffer);
  console.log("DOCX genere avec succes");
});
