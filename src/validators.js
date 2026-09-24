/**
 * validators.js
 * Validaciones heurísticas. No son un análisis semántico profundo (eso requeriría
 * un LLM en el loop), sino reglas lógicas/estructurales que detectan omisiones
 * comunes y guían al investigador. Se documentan como "heurísticas" en los mensajes
 * para no sobre-prometer precisión.
 */

const { getSectionDef, SECTION_KEYS } = require('./schema');

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Validación de una sección individual contra su definición de schema. */
function validateSection(sectionKey, content, project) {
  const def = getSectionDef(sectionKey);
  if (!def) {
    return { valid: false, issues: [`Sección desconocida: ${sectionKey}`], warnings: [], wordCount: 0 };
  }

  const issues = [];
  const warnings = [];
  const wordCount = countWords(content);

  if (!content || !content.trim()) {
    issues.push('La sección está vacía. Aún no se ha recibido contenido del investigador.');
    return { valid: false, issues, warnings, wordCount: 0, section: def.title };
  }

  // Dependencias: secciones previas requeridas
  for (const dep of def.dependsOn) {
    const depContent = project?.sections?.[dep]?.content || '';
    if (!depContent.trim()) {
      warnings.push(
        `Esta sección normalmente depende de "${getSectionDef(dep).title}", que aún está vacía. ` +
          `Es recomendable completarla primero para mantener coherencia.`
      );
    }
  }

  // Conteo de palabras
  if (wordCount < def.minWords) {
    issues.push(
      `Extensión insuficiente: ${wordCount} palabras (mínimo recomendado: ${def.minWords}). ` +
        `Puede indicar que falta desarrollo de alguna idea.`
    );
  }
  if (def.maxWords && wordCount > def.maxWords) {
    warnings.push(
      `Extensión mayor a la recomendada: ${wordCount} palabras (máximo sugerido: ${def.maxWords}). ` +
        `Considera si todo el contenido es esencial para esta sección.`
    );
  }

  // Elementos requeridos (heurística por palabras clave/patrones)
  const missingElements = [];
  for (const el of def.requiredElements) {
    if (!el.pattern.test(content)) {
      missingElements.push(el.name);
    }
  }
  if (missingElements.length > 0) {
    warnings.push(
      `No se detectaron señales claras de: ${missingElements.join(', ')}. ` +
        `Esto es una heurística por palabras clave, revisa manualmente si ya lo cubres con otra redacción.`
    );
  }

  const valid = issues.length === 0;

  return {
    section: def.title,
    valid,
    wordCount,
    minWords: def.minWords,
    maxWords: def.maxWords,
    issues,
    warnings,
  };
}

/** Extrae claves de citas tipo (Autor, 2020) o \cite{clave} de un texto. */
function extractCitations(text) {
  if (!text) return [];
  const citations = new Set();

  // Estilo (Autor, Año) o (Autor et al., Año)
  const parenRegex = /\(([A-ZÀ-Ý][a-zà-ÿ'’-]+(?:\s+et al\.)?),?\s*(\d{4}[a-z]?)\)/g;
  let m;
  while ((m = parenRegex.exec(text)) !== null) {
    citations.add(`${m[1]}, ${m[2]}`);
  }

  // Estilo LaTeX \cite{clave1,clave2}
  const citeRegex = /\\cite[tp]?\{([^}]+)\}/g;
  while ((m = citeRegex.exec(text)) !== null) {
    m[1].split(',').forEach((k) => citations.add(k.trim()));
  }

  return Array.from(citations);
}

/**
 * Validación cruzada de todo el artículo: coherencia entre secciones,
 * no solo cumplimiento individual.
 */
function validateArticle(project) {
  const report = {
    completedSections: [],
    missingSections: [],
    perSection: {},
    crossChecks: [],
    overallValid: true,
  };

  for (const key of SECTION_KEYS) {
    const content = project.sections[key]?.content || '';
    const result = validateSection(key, content, project);
    report.perSection[key] = result;
    if (content.trim()) {
      report.completedSections.push(key);
    } else {
      report.missingSections.push(key);
    }
    if (!result.valid) report.overallValid = false;
  }

  if (report.missingSections.length > 0) {
    report.crossChecks.push({
      check: 'Secciones completas',
      status: 'warning',
      detail: `Faltan por completar: ${report.missingSections.join(', ')}.`,
    });
  }

  // Citas usadas en el cuerpo vs. lista de referencias
  const bodyKeys = ['introduction', 'methods', 'results', 'discussion', 'conclusion'];
  const bodyCitations = new Set();
  for (const key of bodyKeys) {
    extractCitations(project.sections[key]?.content || '').forEach((c) => bodyCitations.add(c));
  }
  const referencesText = project.sections.references?.content || '';

  if (bodyCitations.size > 0) {
    const missingInReferences = Array.from(bodyCitations).filter((c) => {
      const authorPart = c.split(',')[0].trim();
      return !referencesText.toLowerCase().includes(authorPart.toLowerCase());
    });
    if (missingInReferences.length > 0) {
      report.crossChecks.push({
        check: 'Citas vs. referencias',
        status: 'issue',
        detail: `Estas citas aparecen en el cuerpo del texto pero no se detectan en Referencias: ${missingInReferences.join('; ')}.`,
      });
      report.overallValid = false;
    } else {
      report.crossChecks.push({
        check: 'Citas vs. referencias',
        status: 'ok',
        detail: 'Todas las citas detectadas en el cuerpo tienen correspondencia aparente en Referencias.',
      });
    }
  }

  // Objetivo en Introducción vs. reflejo en Discusión/Conclusión
  const intro = project.sections.introduction?.content || '';
  const discussion = project.sections.discussion?.content || '';
  const conclusion = project.sections.conclusion?.content || '';
  if (intro.trim() && (discussion.trim() || conclusion.trim())) {
    const objectiveMatch = intro.match(/(?:objetivo[^.]*\.|se propone[^.]*\.|hipotetizamos[^.]*\.)/i);
    if (objectiveMatch) {
      const objectiveWords = objectiveMatch[0]
        .toLowerCase()
        .replace(/[^a-zà-ú0-9\s]/gi, '')
        .split(/\s+/)
        .filter((w) => w.length > 5); // palabras significativas
      const combinedLater = (discussion + ' ' + conclusion).toLowerCase();
      const overlap = objectiveWords.filter((w) => combinedLater.includes(w));
      const overlapRatio = objectiveWords.length ? overlap.length / objectiveWords.length : 0;
      if (overlapRatio < 0.15) {
        report.crossChecks.push({
          check: 'Objetivo retomado en Discusión/Conclusión',
          status: 'warning',
          detail:
            'El objetivo detectado en la Introducción no parece retomarse explícitamente en Discusión/Conclusión. ' +
            'Verifica manualmente: esta es una heurística por coincidencia de palabras, no comprensión semántica.',
        });
      } else {
        report.crossChecks.push({
          check: 'Objetivo retomado en Discusión/Conclusión',
          status: 'ok',
          detail: 'Se detecta relación léxica entre el objetivo planteado y la Discusión/Conclusión.',
        });
      }
    }
  }

  // Orden de dependencias: si una sección posterior está más desarrollada que una previa vacía
  for (const key of bodyKeys) {
    const def = require('./schema').getSectionDef(key);
    for (const dep of def.dependsOn) {
      const depEmpty = !(project.sections[dep]?.content || '').trim();
      const thisHasContent = (project.sections[key]?.content || '').trim().length > 0;
      if (depEmpty && thisHasContent) {
        report.crossChecks.push({
          check: `Orden lógico: ${key} depende de ${dep}`,
          status: 'warning',
          detail: `"${def.title}" tiene contenido pero "${require('./schema').getSectionDef(dep).title}" aún está vacía.`,
        });
      }
    }
  }

  return report;
}

module.exports = { validateSection, validateArticle, extractCitations, countWords };
