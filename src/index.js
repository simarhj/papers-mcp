#!/usr/bin/env node
/**
 * index.js
 * Servidor MCP "scientific-article-guide".
 * Expone herramientas para crear, guiar, recibir contenido y validar
 * artículos científicos con estructura IMRaD, con persistencia local.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { IMRAD_SECTIONS, SECTION_KEYS, getSectionDef } = require('./schema');
const store = require('./store');
const { validateSection, validateArticle } = require('./validators');

const server = new McpServer({
  name: 'scientific-article-guide',
  version: '1.0.0',
});

const sectionEnum = z.enum(SECTION_KEYS);

function fmtSectionList() {
  return IMRAD_SECTIONS.map(
    (s) => `${s.order}. ${s.title} (clave: "${s.key}")`
  ).join('\n');
}

function findNextQuestion(def, sectionData) {
  const answers = sectionData.answers || {};
  return def.questions.find((q) => !(answers[q.id] || '').trim()) || null;
}

function fmtValidation(result) {
  const lines = [`## Validación: ${result.section}`, `Palabras: ${result.wordCount}${result.minWords ? ` (mínimo ${result.minWords})` : ''}`];
  if (result.issues?.length) {
    lines.push('\n**Problemas a corregir:**');
    result.issues.forEach((i) => lines.push(`- ❌ ${i}`));
  }
  if (result.warnings?.length) {
    lines.push('\n**Advertencias (revisar):**');
    result.warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
  }
  if (!result.issues?.length && !result.warnings?.length) {
    lines.push('\n✅ Sin observaciones estructurales.');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// TOOL: create_article
// ---------------------------------------------------------------------------
server.registerTool(
  'create_article',
  {
    title: 'Crear nuevo artículo científico',
    description:
      'Inicia un nuevo proyecto de artículo científico con estructura IMRaD y persistencia local. ' +
      'Devuelve un projectId que debe usarse en el resto de las herramientas.',
    inputSchema: {
      title: z.string().min(3).describe('Título de trabajo del artículo (puede refinarse después)'),
      researchField: z.string().optional().describe('Área/disciplina del estudio, ej. "biología marina", "ciencias de la computación"'),
    },
  },
  async ({ title, researchField }) => {
    const project = store.createProject({ title, researchField });
    return {
      content: [
        {
          type: 'text',
          text:
            `Proyecto creado. **projectId: ${project.id}**\n\n` +
            `Estructura a seguir (IMRaD), todas las secciones son obligatorias salvo que se marquen como opcionales:\n${fmtSectionList()}\n\n` +
            `Recomendación: empieza por la Introducción (o el Resumen al final, una vez tengas resultados). ` +
            `Usa "get_next_question" con este projectId y la clave de sección para que te pregunte, paso a paso, ` +
            `por cada punto que debe cubrir esa sección.`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// TOOL: list_articles
// ---------------------------------------------------------------------------
server.registerTool(
  'list_articles',
  {
    title: 'Listar artículos guardados',
    description: 'Lista todos los proyectos de artículos guardados localmente, con su progreso.',
    inputSchema: {},
  },
  async () => {
    const projects = store.listProjects();
    if (projects.length === 0) {
      return { content: [{ type: 'text', text: 'No hay proyectos guardados todavía. Usa "create_article" para empezar uno.' }] };
    }
    const text = projects
      .map((p) => `- **${p.title}** (id: ${p.id}) — ${p.progress} — última actualización: ${p.updatedAt}`)
      .join('\n');
    return { content: [{ type: 'text', text }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: get_project_status
// ---------------------------------------------------------------------------
server.registerTool(
  'get_project_status',
  {
    title: 'Estado del proyecto',
    description: 'Muestra qué secciones están completas, cuáles faltan, y sugiere el siguiente paso lógico.',
    inputSchema: { projectId: z.string() },
  },
  async ({ projectId }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const lines = [`# Estado de "${project.title}" (${projectId})\n`];
    for (const def of IMRAD_SECTIONS) {
      const section = project.sections[def.key] || {};
      const content = section.content || '';
      const answeredCount = Object.keys(section.answers || {}).filter((k) => (section.answers[k] || '').trim()).length;
      const totalQuestions = def.questions.length;
      const tag = def.optional ? '(opcional)' : '(obligatoria)';

      let status;
      if (content.trim()) {
        status = '✅ con contenido';
      } else if (answeredCount > 0) {
        status = `🟡 en progreso (${answeredCount}/${totalQuestions} preguntas respondidas)`;
      } else {
        status = '⬜ vacía';
      }
      lines.push(`${def.order}. ${def.title} ${tag} — ${status}`);
    }

    const missingRequired = IMRAD_SECTIONS.filter((def) => !def.optional && !(project.sections[def.key]?.content || '').trim());
    const missingOptional = IMRAD_SECTIONS.filter((def) => def.optional && !(project.sections[def.key]?.content || '').trim());

    if (missingRequired.length > 0) {
      lines.push(
        `\n**Siguiente paso sugerido:** trabajar en "${missingRequired[0].title}" (clave: "${missingRequired[0].key}"), ` +
          `es una sección obligatoria. Usa "get_next_question" para que te guíe pregunta por pregunta.`
      );
    } else if (missingOptional.length > 0) {
      lines.push(
        `\n**Todas las secciones obligatorias tienen contenido.** Quedan secciones opcionales sin completar: ` +
          `${missingOptional.map((d) => d.title).join(', ')}. Puedes completarlas o ejecutar "validate_full_article".`
      );
    } else {
      lines.push('\n**Todas las secciones tienen contenido.** Ejecuta "validate_full_article" para una revisión integral.');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: get_section_guidance
// ---------------------------------------------------------------------------
server.registerTool(
  'get_section_guidance',
  {
    title: 'Obtener guía para una sección',
    description:
      'Devuelve de un vistazo todas las preguntas guía y requisitos estructurales de una sección (útil como resumen/checklist). ' +
      'Para construir el contenido paso a paso, con una pregunta obligatoria a la vez, usa "get_next_question" en su lugar.',
    inputSchema: { projectId: z.string(), section: sectionEnum },
  },
  async ({ projectId, section }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const def = getSectionDef(section);
    const existing = project.sections[section]?.content || '';

    const depWarnings = def.dependsOn
      .filter((dep) => !(project.sections[dep]?.content || '').trim())
      .map((dep) => `- "${getSectionDef(dep).title}" todavía está vacía; normalmente conviene completarla antes.`);

    const lines = [
      `# Guía para: ${def.title} ${def.optional ? '(opcional)' : '(obligatoria)'}`,
      `Extensión recomendada: ${def.minWords}${def.maxWords ? `–${def.maxWords}` : '+'} palabras.\n`,
      '**Preguntas guía para redactar (con tus propias palabras/datos, no copiar de otras fuentes):**',
      ...def.guidance.map((g) => `- ${g}`),
    ];

    if (def.requiredElements.length) {
      lines.push('\n**Elementos que la validación buscará:**');
      def.requiredElements.forEach((el) => lines.push(`- ${el.name}`));
    }

    if (depWarnings.length) {
      lines.push('\n**Nota de dependencia:**', ...depWarnings);
    }

    if (existing.trim()) {
      lines.push(`\n**Ya existe contenido guardado en esta sección** (${existing.trim().split(/\s+/).length} palabras). Puedes revisarlo o sobrescribirlo con "submit_section_content".`);
    } else {
      lines.push('\nCuando tengas tu redacción, envíala con "submit_section_content".');
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: get_next_question
// ---------------------------------------------------------------------------
server.registerTool(
  'get_next_question',
  {
    title: 'Obtener la siguiente pregunta de una sección',
    description:
      'Flujo guiado recomendado: devuelve la siguiente pregunta sin responder de una sección, una a la vez, ' +
      'para que el investigador construya el contenido punto por punto. Úsala junto con "answer_section_question".',
    inputSchema: { projectId: z.string(), section: sectionEnum },
  },
  async ({ projectId, section }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const def = getSectionDef(section);
    const sectionData = project.sections[section];

    if (sectionData.content.trim()) {
      const wc = sectionData.content.trim().split(/\s+/).length;
      return {
        content: [
          {
            type: 'text',
            text:
              `La sección "${def.title}" ya tiene contenido guardado (${wc} palabras).\n` +
              `Si quieres reescribirla con el flujo de preguntas guiadas, usa "answer_section_question" para cualquiera ` +
              `de sus preguntas (esto reemplazará el contenido actual al terminar). Si no, puedes revisarla con "validate_section" ` +
              `o consultarla con "get_section_content".`,
          },
        ],
      };
    }

    const next = findNextQuestion(def, sectionData);
    if (!next) {
      return {
        content: [
          {
            type: 'text',
            text: `Ya respondiste todas las preguntas de "${def.title}", pero el contenido no se ensambló. Usa "answer_section_question" de nuevo con cualquier pregunta para regenerarlo.`,
          },
        ],
      };
    }

    const index = def.questions.findIndex((q) => q.id === next.id);
    return {
      content: [
        {
          type: 'text',
          text:
            `# Pregunta ${index + 1} de ${def.questions.length} — ${def.title}\n\n` +
            `${next.prompt}\n\n` +
            `Responde con "answer_section_question" (projectId: "${projectId}", section: "${section}", questionId: "${next.id}").`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// TOOL: answer_section_question
// ---------------------------------------------------------------------------
server.registerTool(
  'answer_section_question',
  {
    title: 'Responder una pregunta de una sección',
    description:
      'Guarda la respuesta del investigador a una pregunta específica de una sección. Cuando todas las preguntas ' +
      'de la sección tienen respuesta, ensambla y guarda automáticamente el contenido, y corre la validación.',
    inputSchema: {
      projectId: z.string(),
      section: sectionEnum,
      questionId: z.string().describe('id de la pregunta, obtenido de "get_next_question"'),
      answer: z.string().min(1),
    },
  },
  async ({ projectId, section, questionId, answer }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const def = getSectionDef(section);
    const question = def.questions.find((q) => q.id === questionId);
    if (!question) {
      return {
        content: [
          {
            type: 'text',
            text: `questionId "${questionId}" no existe para la sección "${def.title}". IDs válidos: ${def.questions.map((q) => q.id).join(', ')}.`,
          },
        ],
        isError: true,
      };
    }

    const sectionData = project.sections[section];
    sectionData.answers[questionId] = answer;
    sectionData.updatedAt = new Date().toISOString();

    const next = findNextQuestion(def, sectionData);
    if (next) {
      store.saveProject(project);
      const index = def.questions.findIndex((q) => q.id === next.id);
      return {
        content: [
          {
            type: 'text',
            text:
              `Respuesta guardada (${Object.keys(sectionData.answers).filter((k) => sectionData.answers[k].trim()).length}/${def.questions.length}).\n\n` +
              `# Pregunta ${index + 1} de ${def.questions.length} — ${def.title}\n\n${next.prompt}`,
          },
        ],
      };
    }

    // Todas las preguntas respondidas: ensamblar contenido y validar.
    const assembled = def.questions.map((q) => sectionData.answers[q.id].trim()).join('\n\n');
    sectionData.content = assembled;
    const result = validateSection(section, assembled, project);
    sectionData.lastValidation = result;
    store.saveProject(project);

    return {
      content: [
        {
          type: 'text',
          text:
            `✅ Todas las preguntas de "${def.title}" fueron respondidas. Contenido ensamblado y guardado.\n\n` +
            `**Borrador ensamblado:**\n${assembled}\n\n` +
            `${fmtValidation(result)}\n\n` +
            `Si quieres pulir la redacción (unir frases, mejorar transiciones), puedes reenviar la versión final con "submit_section_content".`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// TOOL: submit_section_content
// ---------------------------------------------------------------------------
server.registerTool(
  'submit_section_content',
  {
    title: 'Enviar contenido de una sección (modo libre)',
    description:
      'Guarda contenido ya redactado por el investigador para una sección (de una sola vez, en modo libre) y ejecuta ' +
      'automáticamente la validación estructural. Alternativa a "get_next_question"/"answer_section_question" ' +
      '(el flujo guiado punto por punto); útil cuando el investigador ya trae la sección escrita o quiere ' +
      'reemplazar el borrador ensamblado por una versión pulida.',
    inputSchema: { projectId: z.string(), section: sectionEnum, content: z.string().min(1) },
  },
  async ({ projectId, section, content }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    project.sections[section].content = content;
    project.sections[section].updatedAt = new Date().toISOString();

    const result = validateSection(section, content, project);
    project.sections[section].lastValidation = result;
    store.saveProject(project);

    return { content: [{ type: 'text', text: `Contenido guardado.\n\n${fmtValidation(result)}` }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: validate_section
// ---------------------------------------------------------------------------
server.registerTool(
  'validate_section',
  {
    title: 'Validar una sección existente',
    description: 'Re-ejecuta la validación estructural sobre el contenido ya guardado de una sección, sin necesidad de reenviarlo.',
    inputSchema: { projectId: z.string(), section: sectionEnum },
  },
  async ({ projectId, section }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const content = project.sections[section]?.content || '';
    const result = validateSection(section, content, project);
    return { content: [{ type: 'text', text: fmtValidation(result) }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: validate_full_article
// ---------------------------------------------------------------------------
server.registerTool(
  'validate_full_article',
  {
    title: 'Validar el artículo completo',
    description:
      'Ejecuta validación de cada sección más chequeos cruzados: citas vs. referencias, ' +
      'coherencia entre objetivo (Introducción) y Discusión/Conclusión, y orden lógico de dependencias.',
    inputSchema: { projectId: z.string() },
  },
  async ({ projectId }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };

    const report = validateArticle(project);

    const lines = [`# Validación integral: "${project.title}"\n`];
    lines.push(report.overallValid ? '✅ **Estado general: sin problemas bloqueantes detectados.**' : '❌ **Estado general: hay problemas que revisar.**');

    lines.push('\n## Chequeos cruzados');
    if (report.crossChecks.length === 0) {
      lines.push('(Aún no hay suficiente contenido para chequeos cruzados.)');
    } else {
      report.crossChecks.forEach((c) => {
        const icon = c.status === 'ok' ? '✅' : c.status === 'warning' ? '⚠️' : '❌';
        lines.push(`- ${icon} **${c.check}:** ${c.detail}`);
      });
    }

    lines.push('\n## Detalle por sección');
    for (const key of SECTION_KEYS) {
      const r = report.perSection[key];
      lines.push(`\n### ${r.section}`);
      lines.push(fmtValidation(r).split('\n').slice(1).join('\n'));
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ---------------------------------------------------------------------------
// TOOL: get_section_content
// ---------------------------------------------------------------------------
server.registerTool(
  'get_section_content',
  {
    title: 'Obtener contenido guardado de una sección',
    description: 'Devuelve el texto actualmente guardado para una sección específica del proyecto.',
    inputSchema: { projectId: z.string(), section: sectionEnum },
  },
  async ({ projectId, section }) => {
    const project = store.getProject(projectId);
    if (!project) return { content: [{ type: 'text', text: `No existe un proyecto con id "${projectId}".` }], isError: true };
    const content = project.sections[section]?.content || '';
    return {
      content: [
        {
          type: 'text',
          text: content.trim() ? content : `(La sección "${getSectionDef(section).title}" todavía está vacía.)`,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Arranque del servidor (stdio, para Claude Desktop)
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('scientific-article-guide MCP server corriendo (stdio).');
}

main().catch((err) => {
  console.error('Error fatal iniciando el servidor MCP:', err);
  process.exit(1);
});
