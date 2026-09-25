# scientific-article-guide (MCP Server)

Servidor MCP (Model Context Protocol) que guía la construcción de un artículo
científico con estructura **IMRaD** (Introducción, Métodos, Resultados y
Discusión), valida cada sección con reglas lógicas/heurísticas, y **guarda el
proyecto como una carpeta real en el disco del investigador** (Markdown +
biblioteca de referencias + carpetas de apoyo), con exportación a LaTeX, PDF
y Word.

> El servidor **nunca genera contenido científico por ti**: solo guarda lo
> que tú redactas, y valida su estructura. La redacción y las ideas siguen
> siendo tuyas.

## 1. Instalación

Requiere Node.js 18+.

```bash
cd scientific-article-mcp
npm install
```

Prueba rápida de que arranca correctamente:

```bash
node src/index.js
# Deberías ver: "scientific-article-guide MCP server corriendo (stdio)."
# Ctrl+C para salir.
```

## 2. Configurar en Claude Desktop

Edita (o crea) el archivo de configuración de Claude Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Agrega esta entrada (ajusta la ruta absoluta a donde clonaste el proyecto):

```json
{
  "mcpServers": {
    "scientific-article-guide": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/A/scientific-article-mcp/src/index.js"]
    }
  }
}
```

Reinicia Claude Desktop. Deberías ver el ícono de herramientas (🔨) con
18 tools disponibles bajo "scientific-article-guide".

## 3. Flujo de uso típico

1. **`create_article`** — pide la carpeta del disco donde se guardará el proyecto (`projectPath`), y crea ahí la
   estructura completa (ver sección 4). Devuelve un `projectId`.
2. **`get_next_question`** — te da, una a la vez, cada pregunta obligatoria de la sección (ej. en la Introducción:
   contexto → brecha → objetivo). No avanza a la siguiente hasta tener respuesta a la actual.
3. **`answer_section_question`** — guardas tu respuesta a esa pregunta puntual (`questionId` + `answer`). Cuando
   respondes la última pregunta de la sección, el contenido se ensambla, se valida y se reescribe en disco
   automáticamente.
4. **`add_reference`** / **`list_references`** / **`generate_references_section`** — vas construyendo tu biblioteca
   de referencias y, cuando quieras, generas la sección "Referencias" del artículo a partir de ella.
5. **`get_project_status`** — para ver qué secciones faltan (obligatorias vs. opcionales), cuáles están en progreso
   (X/N preguntas respondidas) y cuál es el siguiente paso sugerido.
6. **`validate_full_article`** — corre validaciones cruzadas: citas vs. referencias, coherencia
   objetivo↔discusión, orden lógico de dependencias, y **bloquea** el artículo como incompleto si falta alguna
   sección obligatoria.
7. **`export_to_latex`** / **`export_to_pdf`** / **`export_to_word`** — cuando el artículo esté listo, lo exportas
   desde el Markdown oficial a los formatos que necesites entregar.

Alternativa en modo libre: si ya tienes una sección redactada (o prefieres escribirla de una sola vez), puedes
saltarte el Q&A y usar **`get_section_guidance`** (checklist de referencia) + **`submit_section_content`**
(guarda y valida el texto completo). Ambos flujos son compatibles y escriben al mismo lugar.

## 3.1. Dónde vive el proyecto

**El proyecto se guarda como una carpeta real, en la ruta que tú elijas** (`projectPath` en `create_article`) —
no en un directorio oculto. Ahí se crea:

```
<tu-carpeta-elegida>/
├── article.md          # el artículo completo (Markdown, formato oficial) — se regenera solo
├── LEEME.md             # explicación de la estructura, generada una sola vez
├── sections/            # cada sección IMRaD en su propio .md — se regenera sola
│   ├── 01-title.md
│   ├── 02-abstract.md
│   └── ...
├── references/
│   ├── bibliography.bib # biblioteca de referencias en BibTeX (para LaTeX)
│   └── referencias.md   # la misma biblioteca en lista legible
├── figures/              # tus imágenes, gráficas y tablas
├── data/                 # tus datos crudos o procesados
├── export/               # article.tex / article.pdf / article.docx generados
└── .article-mcp/
    └── project.json      # estado interno del MCP (respuestas, validaciones) — no editar a mano
```

`article.md` y `sections/*.md` se sobrescriben en cada guardado (son una vista, no la fuente de verdad editable a
mano); `figures/`, `data/` y `references/bibliography.bib`/`referencias.md` sí son tuyos para gestionar libremente
(este último también se actualiza al usar `add_reference`).

Un índice liviano en `~/.scientific-article-mcp/index.json` guarda solo `projectId → carpeta`, para que
`list_articles`/`get_project_status` puedan encontrar tus proyectos sin tener que recordar la ruta completa; el
contenido real vive siempre en tu carpeta.

## 4. Herramientas (tools) expuestas

| Tool | Descripción |
|---|---|
| `create_article` | Crea un nuevo proyecto IMRaD en la carpeta que indiques |
| `list_articles` | Lista proyectos guardados con su progreso y carpeta |
| `get_project_status` | Muestra qué secciones faltan (obligatorias/opcionales) y el siguiente paso |
| `get_section_guidance` | Checklist de preguntas guía + requisitos de una sección (vista general) |
| `get_next_question` | Flujo guiado: siguiente pregunta obligatoria sin responder de una sección |
| `answer_section_question` | Guarda la respuesta a una pregunta puntual; ensambla y valida al completar la sección |
| `submit_section_content` | Modo libre: guarda contenido completo de una sección de una vez + valida |
| `validate_section` | Re-valida una sección ya guardada |
| `validate_full_article` | Validación cruzada de todo el artículo (bloquea si faltan secciones obligatorias) |
| `get_section_content` | Recupera el texto guardado de una sección |
| `add_reference` | Agrega una entrada a la biblioteca de referencias del proyecto |
| `list_references` | Lista las referencias guardadas en la biblioteca |
| `generate_references_section` | Ensambla la sección "Referencias" a partir de la biblioteca |
| `export_markdown` | Fuerza la regeneración de todos los archivos Markdown del proyecto |
| `set_word_template` | Sube un `.docx` para usar sus estilos como plantilla en `export_to_word` |
| `export_to_latex` | Exporta `article.md` a `export/article.tex` (requiere `pandoc`) |
| `export_to_pdf` | Exporta `article.md` a `export/article.pdf` (requiere `pandoc` + motor LaTeX) |
| `export_to_word` | Exporta `article.md` a `export/article.docx` (requiere `pandoc`; usa la plantilla si hay una) |

## 4.1. Secciones obligatorias

Por defecto, **las 9 secciones IMRaD son obligatorias**: `validate_full_article` marca el artículo como
incompleto (❌ bloqueante) mientras alguna tenga contenido vacío. Puedes eximir una sección puntual marcándola
como `optional: true` en `src/schema.js` (por ejemplo, para artículos de revisión sin Métodos/Resultados
experimentales); las secciones opcionales vacías solo generan una advertencia, no bloquean la validación.

## 5. Naturaleza de las validaciones

Las validaciones son **heurísticas estructurales** (conteo de palabras,
presencia de palabras clave/patrones típicos, coincidencia de citas entre
cuerpo y referencias, solapamiento léxico entre objetivo y discusión). No son
un análisis semántico profundo ni un revisor de calidad científica: su
función es **detectar omisiones estructurales comunes** (ej. "esta
introducción no tiene un objetivo explícito", "esta cita no está en tu lista
de referencias"), no evaluar la validez científica del contenido.

## 6. Extender la estructura

Toda la definición de secciones, límites de palabras, dependencias y
elementos requeridos vive en `src/schema.js`. Puedes:

- Ajustar `minWords`/`maxWords` por sección.
- Agregar/quitar `requiredElements` (patrones regex/keywords).
- Adaptar la estructura a otro formato (ej. quitar Métodos/Resultados para
  artículos de revisión bibliográfica, o añadir subsecciones).

## 7. Exportación a LaTeX / PDF / Word

El formato oficial de trabajo es **Markdown** (`article.md`), pero el MCP puede convertirlo usando
[`pandoc`](https://pandoc.org), que **no es una dependencia de npm**: debe instalarse en el sistema por separado.

```bash
# macOS
brew install pandoc
brew install --cask basictex   # solo necesario para exportar a PDF

# Ubuntu/Debian
sudo apt install pandoc texlive-latex-base   # texlive solo para PDF
```

Si `pandoc` (o, para PDF, un motor LaTeX) no está instalado, las herramientas `export_to_latex`/`export_to_pdf`/
`export_to_word` devuelven un mensaje explicando qué falta instalar, en vez de fallar de forma críptica.

**Nota (macOS/Claude Desktop):** las apps de escritorio lanzan procesos con un `PATH` mínimo que no incluye las
rutas de Homebrew ni de TeX, aunque en tu terminal sí las tengas. El servidor ya agrega automáticamente
`/opt/homebrew/bin`, `/usr/local/bin` y `/Library/TeX/texbin` al `PATH` del proceso que invoca a `pandoc`
(ver `src/exporters.js`), así que no deberías tener que hacer nada adicional tras instalarlos con Homebrew.

## 7.1. Usar una plantilla Word (ej. la de tu universidad o revista)

Si necesitas entregar el artículo en el formato exacto de una plantilla institucional (fuente, márgenes, estilos
de encabezado, numeración), sube ese `.docx` con **`set_word_template`**:

```
set_word_template({ projectId, templatePath: "/ruta/a/plantilla-de-la-revista.docx" })
```

Esto copia el archivo a `templates/word-template.docx` dentro de la carpeta del proyecto. A partir de ahí, cada
vez que uses `export_to_word`, pandoc generará el `.docx` **con el contenido de tu artículo pero con los estilos
de esa plantilla** (usa el mecanismo `--reference-doc` de pandoc). El texto de la plantilla en sí no se usa, solo
sus estilos con nombre (Title, Heading 1, Heading 2, Body Text, etc.).

Si la plantilla que te dieron no produce el resultado esperado (por ejemplo, porque sus estilos no siguen esos
nombres), una alternativa es generar primero una plantilla base editable con:

```bash
pandoc -o reference.docx --print-default-data-file reference.docx
```

y ajustar ahí manualmente las fuentes/márgenes/estilos antes de subirla con `set_word_template`.

## 8. Pruebas

Hay un test end-to-end que levanta el servidor real vía stdio y ejercita el
flujo completo:

```bash
node test/e2e.js
```
