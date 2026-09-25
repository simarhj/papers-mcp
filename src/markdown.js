/**
 * markdown.js
 * Mantiene la representación en Markdown del artículo dentro de la carpeta de
 * proyecto del investigador: el formato oficial de trabajo. Se regenera cada
 * vez que cambia el contenido de una sección, para que la carpeta siempre
 * refleje el estado guardado (sin que el investigador tenga que exportar nada
 * manualmente).
 */

const fs = require('fs');
const path = require('path');
const { IMRAD_SECTIONS, getSectionDef } = require('./schema');

const PROJECT_DIRS = ['sections', 'references', 'figures', 'data', 'export', 'templates', '.article-mcp'];

function sectionFileName(def) {
  return `${String(def.order).padStart(2, '0')}-${def.key}.md`;
}

function scaffoldProjectDir(projectPath) {
  for (const dir of PROJECT_DIRS) {
    fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
  }
}

function writeReadmeIfMissing(project) {
  const readmePath = path.join(project.projectPath, 'LEEME.md');
  if (fs.existsSync(readmePath)) return;
  const text = `# ${project.title}

Proyecto de artículo científico gestionado con **scientific-article-guide (MCP)**.

## Estructura de esta carpeta

- \`article.md\` — el artículo completo ensamblado (se regenera automáticamente, no lo edites a mano).
- \`sections/\` — cada sección IMRaD en su propio archivo Markdown (también autogenerado).
- \`references/\` — biblioteca de referencias bibliográficas: \`bibliography.bib\` (BibTeX) y \`referencias.md\` (lista legible).
- \`figures/\` — figuras, gráficas e imágenes del artículo.
- \`data/\` — datos crudos o procesados.
- \`export/\` — versiones exportadas del artículo (LaTeX, PDF, Word), generadas con las herramientas de exportación del MCP.
- \`templates/\` — plantilla Word (\`word-template.docx\`) subida con "set_word_template"; si existe, la exportación a Word hereda sus estilos (fuentes, márgenes, encabezados).
- \`.article-mcp/\` — estado interno del MCP (respuestas guardadas, validaciones). No editar a mano.

**El formato oficial de trabajo es Markdown.** Para redactar, usa las herramientas del MCP
(\`get_next_question\` / \`answer_section_question\`, o \`submit_section_content\`) en vez de editar
\`article.md\` directamente, ya que ese archivo se sobrescribe con cada guardado.
`;
  fs.writeFileSync(readmePath, text, 'utf-8');
}

function sectionMarkdown(def, content) {
  const trimmed = (content || '').trim();
  const body = trimmed || `_(Pendiente — sección ${def.optional ? 'opcional' : 'obligatoria'} sin contenido todavía)_`;
  return `# ${def.title}\n\n${body}\n`;
}

function writeSectionFile(projectPath, def, content) {
  const file = path.join(projectPath, 'sections', sectionFileName(def));
  fs.writeFileSync(file, sectionMarkdown(def, content), 'utf-8');
}

function buildArticleMarkdown(project) {
  const get = (key) => (project.sections[key]?.content || '').trim();
  const title = get('title') || project.title;
  const keywords = get('keywords');

  const lines = ['---', `title: "${title.replace(/"/g, '\\"')}"`, `date: "${new Date().toISOString().slice(0, 10)}"`, '---', ''];

  lines.push('## Resumen', '', get('abstract') || '_(Pendiente)_', '');
  if (keywords) lines.push(`**Palabras clave:** ${keywords}`, '');

  for (const key of ['introduction', 'methods', 'results', 'discussion', 'conclusion']) {
    const def = getSectionDef(key);
    const content = get(key);
    lines.push(`## ${def.title}`, '', content || `_(Pendiente${def.optional ? ' — opcional' : ''})_`, '');
  }

  lines.push('## Referencias', '', get('references') || '_(Pendiente)_', '');

  return lines.join('\n');
}

function writeArticleFile(project) {
  fs.writeFileSync(path.join(project.projectPath, 'article.md'), buildArticleMarkdown(project), 'utf-8');
}

/** Regenera article.md y todos los sections/*.md a partir del estado actual del proyecto. */
function syncAllMarkdown(project) {
  scaffoldProjectDir(project.projectPath);
  for (const def of IMRAD_SECTIONS) {
    writeSectionFile(project.projectPath, def, project.sections[def.key]?.content || '');
  }
  writeArticleFile(project);
  writeReadmeIfMissing(project);
}

function writeBibliographyFiles(project) {
  const dir = path.join(project.projectPath, 'references');
  fs.mkdirSync(dir, { recursive: true });

  const entries = Object.entries(project.bibliography || {});

  const bibtexParts = entries.filter(([, e]) => e.bibtex && e.bibtex.trim()).map(([, e]) => e.bibtex.trim());
  fs.writeFileSync(
    path.join(dir, 'bibliography.bib'),
    bibtexParts.length ? bibtexParts.join('\n\n') + '\n' : '% Aún no hay entradas BibTeX. Usa "add_reference" con el campo bibtex.\n',
    'utf-8'
  );

  const mdLines = ['# Biblioteca de referencias', ''];
  if (entries.length === 0) {
    mdLines.push('_(Aún no se han agregado referencias con "add_reference")_');
  } else {
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, e]) => mdLines.push(`- **[${key}]** ${e.citation}`));
  }
  fs.writeFileSync(path.join(dir, 'referencias.md'), mdLines.join('\n') + '\n', 'utf-8');
}

module.exports = {
  scaffoldProjectDir,
  syncAllMarkdown,
  writeArticleFile,
  writeSectionFile,
  writeBibliographyFiles,
  buildArticleMarkdown,
  sectionFileName,
};
