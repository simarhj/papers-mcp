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
8 tools disponibles bajo "scientific-article-guide".

## 3. Flujo de uso típico

1. **`create_article`** — crea el proyecto (título + área de investigación). Devuelve un `projectId`.
2. **`get_section_guidance`** — para cada sección, pide las preguntas guía y los elementos que se validarán.
3. Redactas la sección tú mismo (o dictándosela a Claude en la conversación, con tus datos/ideas).
4. **`submit_section_content`** — guarda el contenido y corre la validación automáticamente.
5. **`get_project_status`** — para ver qué falta y cuál es el siguiente paso sugerido.
6. **`validate_full_article`** — al final, corre validaciones cruzadas: citas vs. referencias, coherencia objetivo↔discusión, orden lógico de dependencias.

Los proyectos se guardan en `~/.scientific-article-mcp/projects/<id>.json` y
persisten aunque cierres Claude Desktop.

## 4. Herramientas (tools) expuestas

| Tool | Descripción |
|---|---|
| `create_article` | Crea un nuevo proyecto IMRaD |
| `list_articles` | Lista proyectos guardados con su progreso |
| `get_project_status` | Muestra qué secciones faltan y el siguiente paso |
| `get_section_guidance` | Preguntas guía + requisitos de una sección |
| `submit_section_content` | Guarda contenido de una sección + valida |
| `validate_section` | Re-valida una sección ya guardada |
| `validate_full_article` | Validación cruzada de todo el artículo |
| `get_section_content` | Recupera el texto guardado de una sección |

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
