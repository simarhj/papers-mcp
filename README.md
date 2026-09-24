# scientific-article-guide (MCP Server)

Servidor MCP (Model Context Protocol) que guía la construcción de un artículo
científico con estructura **IMRaD** (Introducción, Métodos, Resultados y
Discusión), valida cada sección con reglas lógicas/heurísticas, y **persiste
el progreso en disco** para que el contexto sobreviva entre sesiones de
Claude Desktop.

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
10 tools disponibles bajo "scientific-article-guide".

## 3. Flujo de uso típico

1. **`create_article`** — crea el proyecto (título + área de investigación). Devuelve un `projectId`.
2. **`get_next_question`** — te da, una a la vez, cada pregunta obligatoria de la sección (ej. en la Introducción:
   contexto → brecha → objetivo). No avanza a la siguiente hasta tener respuesta a la actual.
3. **`answer_section_question`** — guardas tu respuesta a esa pregunta puntual (`questionId` + `answer`). Cuando
   respondes la última pregunta de la sección, el contenido se ensambla y se valida automáticamente.
4. **`get_project_status`** — para ver qué secciones faltan (obligatorias vs. opcionales), cuáles están en progreso
   (X/N preguntas respondidas) y cuál es el siguiente paso sugerido.
5. **`validate_full_article`** — al final, corre validaciones cruzadas: citas vs. referencias, coherencia
   objetivo↔discusión, orden lógico de dependencias, y **bloquea** el artículo como incompleto si falta alguna
   sección obligatoria.

Alternativa en modo libre: si ya tienes una sección redactada (o prefieres escribirla de una sola vez), puedes
saltarte el Q&A y usar **`get_section_guidance`** (checklist de referencia) + **`submit_section_content`**
(guarda y valida el texto completo). Ambos flujos son compatibles y escriben al mismo lugar.

Los proyectos se guardan en `~/.scientific-article-mcp/projects/<id>.json` y
persisten aunque cierres Claude Desktop.

## 4. Herramientas (tools) expuestas

| Tool | Descripción |
|---|---|
| `create_article` | Crea un nuevo proyecto IMRaD |
| `list_articles` | Lista proyectos guardados con su progreso |
| `get_project_status` | Muestra qué secciones faltan (obligatorias/opcionales) y el siguiente paso |
| `get_section_guidance` | Checklist de preguntas guía + requisitos de una sección (vista general) |
| `get_next_question` | Flujo guiado: siguiente pregunta obligatoria sin responder de una sección |
| `answer_section_question` | Guarda la respuesta a una pregunta puntual; ensambla y valida al completar la sección |
| `submit_section_content` | Modo libre: guarda contenido completo de una sección de una vez + valida |
| `validate_section` | Re-valida una sección ya guardada |
| `validate_full_article` | Validación cruzada de todo el artículo (bloquea si faltan secciones obligatorias) |
| `get_section_content` | Recupera el texto guardado de una sección |

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

## 7. Pruebas

Hay un test end-to-end que levanta el servidor real vía stdio y ejercita el
flujo completo:

```bash
node test/e2e.js
```
