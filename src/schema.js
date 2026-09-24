/**
 * schema.js
 * Define la estructura IMRaD genérica sobre la que se guía y valida el artículo.
 * Cada sección tiene:
 *  - key: identificador interno
 *  - title: nombre visible
 *  - order: posición esperada (para dependencias de flujo)
 *  - optional: si es false (default), la sección es OBLIGATORIA y bloquea
 *    "validate_full_article" mientras esté vacía. Cambiar a true para
 *    adaptar la plantilla (ej. artículos de revisión sin Métodos/Resultados).
 *  - minWords / maxWords: rango recomendado
 *  - dependsOn: secciones que deberían existir antes de considerar esta "lista"
 *  - requiredElements: heurísticas de contenido que se buscan vía regex/keywords
 *  - guidance: preguntas de autoevaluación (para revisar la sección ya escrita)
 *  - questions: preguntas secuenciales que el MCP hace al investigador, una a
 *    la vez, para construir el contenido de la sección punto por punto
 */

const kw = (...words) => new RegExp(words.join('|'), 'i');

const IMRAD_SECTIONS = [
  {
    key: 'title',
    title: 'Título',
    order: 1,
    optional: false,
    minWords: 4,
    maxWords: 25,
    dependsOn: [],
    requiredElements: [],
    guidance: [
      '¿El título refleja con precisión la pregunta o hallazgo principal del estudio?',
      '¿Evita jerga innecesaria y abreviaturas no explicadas?',
      '¿Es específico? (evita títulos genéricos tipo "Estudio sobre X")',
    ],
    questions: [
      {
        id: 'title_text',
        prompt:
          '¿Cuál es el título del artículo? Debe reflejar la pregunta o hallazgo principal, ' +
          'ser específico (evita "Estudio sobre X") y no usar abreviaturas sin explicar.',
      },
    ],
  },
  {
    key: 'abstract',
    title: 'Resumen / Abstract',
    order: 2,
    optional: false,
    minWords: 120,
    maxWords: 350,
    dependsOn: [],
    requiredElements: [
      { name: 'objetivo/propósito', pattern: kw('objetivo', 'propósito', 'purpose', 'aim', 'se propone', 'busca') },
      { name: 'método', pattern: kw('método', 'metodología', 'method', 'diseño', 'se realizó', 'se llevó a cabo') },
      { name: 'resultado principal', pattern: kw('resultado', 'result', 'se encontró', 'se observó', 'mostró', 'reveló') },
      { name: 'conclusión', pattern: kw('conclu', 'conclusion', 'implica', 'sugiere que') },
    ],
    guidance: [
      '¿Incluye en 1-2 frases: contexto/problema, objetivo, método, resultado clave y conclusión?',
      '¿Puede leerse de forma independiente, sin necesitar el resto del artículo?',
      '¿Evita citas bibliográficas y abreviaturas no estándar?',
    ],
    questions: [
      { id: 'context', prompt: '¿Cuál es el contexto o problema que motiva este estudio? (1-2 frases)' },
      { id: 'objective', prompt: '¿Cuál es el objetivo o propósito del estudio?' },
      { id: 'method', prompt: '¿Qué método o diseño se usó? (resúmelo en una frase)' },
      { id: 'result', prompt: '¿Cuál es el resultado clave encontrado?' },
      { id: 'conclusion', prompt: '¿Cuál es la conclusión o implicación principal?' },
    ],
  },
  {
    key: 'keywords',
    title: 'Palabras clave',
    order: 3,
    optional: false,
    minWords: 3,
    maxWords: 8,
    dependsOn: [],
    requiredElements: [],
    guidance: [
      '¿Son entre 3 y 8 términos?',
      '¿Reflejan los conceptos centrales usados por bases de datos indexadoras (no genéricos)?',
    ],
    questions: [
      {
        id: 'keywords_list',
        prompt: 'Escribe entre 3 y 8 palabras clave (términos centrales del estudio), separadas por comas.',
      },
    ],
  },
  {
    key: 'introduction',
    title: 'Introducción',
    order: 4,
    optional: false,
    minWords: 300,
    maxWords: 1200,
    dependsOn: [],
    requiredElements: [
      { name: 'contexto/antecedentes', pattern: kw('estudios previos', 'investigaciones anteriores', 'se ha demostrado', 'background', 'literatura') },
      { name: 'brecha o problema', pattern: kw('sin embargo', 'no obstante', 'brecha', 'gap', 'limitado', 'pocos estudios', 'aún no', 'permanece poco claro') },
      { name: 'objetivo/hipótesis explícito', pattern: kw('el presente estudio', 'este trabajo tiene como objetivo', 'se propone', 'hipotetizamos', 'objetivo de este', 'aim of this study') },
    ],
    guidance: [
      '¿Presenta el contexto general del tema y por qué importa?',
      '¿Identifica claramente qué falta en el conocimiento actual (la "brecha")?',
      '¿Termina con un objetivo o hipótesis explícita y verificable?',
    ],
    questions: [
      { id: 'context', prompt: '¿Cuál es el contexto general del tema y por qué es relevante? Incluye qué muestran los estudios previos.' },
      { id: 'gap', prompt: '¿Qué falta en el conocimiento actual sobre este tema? (la "brecha" que tu estudio busca cerrar)' },
      { id: 'objective', prompt: '¿Cuál es el objetivo o hipótesis explícita de tu estudio?' },
    ],
  },
  {
    key: 'methods',
    title: 'Métodos',
    order: 5,
    optional: false,
    minWords: 250,
    maxWords: 1500,
    dependsOn: ['introduction'],
    requiredElements: [
      { name: 'diseño del estudio', pattern: kw('diseño', 'design', 'tipo de estudio', 'enfoque cualitativo', 'enfoque cuantitativo', 'experimental') },
      { name: 'muestra/participantes/materiales', pattern: kw('participantes', 'muestra', 'sample', 'materiales', 'sujetos', 'población') },
      { name: 'procedimiento', pattern: kw('procedimiento', 'procedure', 'se llevó a cabo', 'se aplicó', 'protocolo') },
      { name: 'análisis', pattern: kw('análisis', 'analysis', 'se analizó', 'estadístic', 'software') },
    ],
    guidance: [
      '¿Describe el diseño del estudio (experimental, observacional, cualitativo, etc.)?',
      '¿Detalla población/muestra/materiales con suficiente precisión para replicar?',
      '¿Explica el procedimiento paso a paso?',
      '¿Especifica cómo se analizaron los datos (pruebas estadísticas, software, criterios)?',
    ],
    questions: [
      { id: 'design', prompt: '¿Cuál es el diseño del estudio? (experimental, observacional, cualitativo, cuantitativo, etc.)' },
      { id: 'sample', prompt: '¿Cuál es la población, muestra o materiales utilizados? Sé preciso (n, criterios de inclusión, etc.)' },
      { id: 'procedure', prompt: '¿Cuál fue el procedimiento, paso a paso, para poder replicarlo?' },
      { id: 'analysis', prompt: '¿Cómo se analizaron los datos? (pruebas estadísticas, software, criterios)' },
    ],
  },
  {
    key: 'results',
    title: 'Resultados',
    order: 6,
    optional: false,
    minWords: 200,
    maxWords: 1500,
    dependsOn: ['methods'],
    requiredElements: [
      { name: 'datos concretos (cifras/estadísticos)', pattern: /\d/ },
    ],
    guidance: [
      '¿Presenta los hallazgos de forma objetiva, sin interpretarlos todavía?',
      '¿Incluye datos concretos (cifras, valores estadísticos, tablas o figuras referenciadas)?',
      '¿Sigue el mismo orden en que se plantearon los objetivos/métodos?',
    ],
    questions: [
      {
        id: 'findings',
        prompt:
          '¿Cuáles son los hallazgos principales? Preséntalos de forma objetiva (sin interpretarlos aún) ' +
          'e incluye datos concretos: cifras, valores estadísticos, o referencias a tablas/figuras.',
      },
    ],
  },
  {
    key: 'discussion',
    title: 'Discusión',
    order: 7,
    optional: false,
    minWords: 300,
    maxWords: 1500,
    dependsOn: ['results', 'introduction'],
    requiredElements: [
      { name: 'comparación con literatura previa (citas)', pattern: /\(\s*[A-Z][a-zà-ú]+.*?\d{4}\s*\)|\\cite\{/i },
      { name: 'limitaciones', pattern: kw('limitación', 'limitation', 'una limitante', 'cabe señalar que') },
      { name: 'implicaciones/trabajo futuro', pattern: kw('implicaci', 'trabajo futuro', 'future work', 'se recomienda', 'próximas investigaciones') },
    ],
    guidance: [
      '¿Interpreta los resultados (no solo los repite) y explica su significado?',
      '¿Los compara/contrasta con estudios previos citados?',
      '¿Reconoce limitaciones del estudio?',
      '¿Señala implicaciones prácticas/teóricas o líneas futuras?',
    ],
    questions: [
      { id: 'interpretation', prompt: '¿Cómo interpretas los resultados? ¿Qué significan en relación con tu objetivo?' },
      { id: 'comparison', prompt: '¿Cómo se comparan tus resultados con estudios previos? Incluye citas, ej. (Autor, Año).' },
      { id: 'limitations', prompt: '¿Cuáles son las limitaciones de tu estudio?' },
      { id: 'implications', prompt: '¿Cuáles son las implicaciones prácticas/teóricas, o qué trabajo futuro sugieres?' },
    ],
  },
  {
    key: 'conclusion',
    title: 'Conclusión',
    order: 8,
    optional: false,
    minWords: 80,
    maxWords: 400,
    dependsOn: ['discussion'],
    requiredElements: [],
    guidance: [
      '¿Resume el hallazgo principal en relación directa con el objetivo planteado en la introducción?',
      '¿Evita introducir información o citas nuevas?',
      '¿Es concisa y no repite literalmente la discusión?',
    ],
    questions: [
      {
        id: 'summary',
        prompt:
          '¿Cuál es el hallazgo principal, expresado en relación directa con el objetivo planteado en la introducción? ' +
          '(sin introducir información o citas nuevas)',
      },
    ],
  },
  {
    key: 'references',
    title: 'Referencias',
    order: 9,
    optional: false,
    minWords: 0,
    maxWords: null,
    dependsOn: [],
    requiredElements: [],
    guidance: [
      '¿Todas las citas usadas en el cuerpo del texto aparecen en esta lista (y viceversa)?',
      '¿El formato es consistente en todas las entradas (mismo estilo: APA, IEEE, Vancouver...)?',
    ],
    questions: [
      {
        id: 'list',
        prompt:
          'Pega la lista completa de referencias (una por línea) en un formato consistente (APA, IEEE, Vancouver...), ' +
          'incluyendo todas las citas usadas en el cuerpo del artículo.',
      },
    ],
  },
];

const SECTION_KEYS = IMRAD_SECTIONS.map((s) => s.key);

function getSectionDef(key) {
  return IMRAD_SECTIONS.find((s) => s.key === key) || null;
}

module.exports = { IMRAD_SECTIONS, SECTION_KEYS, getSectionDef };
