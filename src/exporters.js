/**
 * exporters.js
 * Convierte article.md a otros formatos (LaTeX, PDF, Word) usando `pandoc`,
 * que debe estar instalado en el sistema del investigador (no es una
 * dependencia de npm: es una herramienta externa estándar en el mundo
 * académico para estas conversiones).
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const INSTALL_HINT =
  'No se encontró "pandoc" en el sistema. Instálalo primero:\n' +
  '  - macOS: brew install pandoc\n' +
  '  - Ubuntu/Debian: sudo apt install pandoc\n' +
  '  - Windows: choco install pandoc (o descarga el instalador desde pandoc.org)';

const PDF_ENGINE_HINT =
  'Para exportar a PDF, pandoc además necesita un motor LaTeX instalado (ej. "brew install --cask basictex" en macOS, ' +
  'o "sudo apt install texlive-latex-base" en Linux), o puedes reintentar indicando otro motor si tienes uno disponible.';

function runPandoc(args) {
  return new Promise((resolve) => {
    execFile('pandoc', args, { maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ENOENT') {
          resolve({ ok: false, error: INSTALL_HINT });
          return;
        }
        resolve({ ok: false, error: (stderr || error.message || '').trim() });
        return;
      }
      resolve({ ok: true, stdout, stderr });
    });
  });
}

const EXT_BY_FORMAT = { latex: 'tex', pdf: 'pdf', docx: 'docx' };

/** Exporta project.projectPath/article.md al formato indicado ('latex' | 'pdf' | 'docx'). */
async function exportArticle(project, format) {
  const ext = EXT_BY_FORMAT[format];
  if (!ext) throw new Error(`Formato de exportación desconocido: ${format}`);

  const exportDir = path.join(project.projectPath, 'export');
  fs.mkdirSync(exportDir, { recursive: true });

  const src = path.join(project.projectPath, 'article.md');
  const out = path.join(exportDir, `article.${ext}`);

  const args = [src, '-o', out, '--standalone'];
  if (format === 'latex') args.push('--to=latex');

  const result = await runPandoc(args);

  if (!result.ok && format === 'pdf' && /pdf-engine|pdflatex|xelatex|lualatex/i.test(result.error)) {
    result.error = `${result.error}\n\n${PDF_ENGINE_HINT}`;
  }

  return { ...result, outputPath: out };
}

module.exports = { exportArticle };
