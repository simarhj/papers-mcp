/**
 * store.js
 * Persistencia del proyecto en la carpeta que el propio investigador elige en
 * su disco (no en una ubicación oculta): el estado interno del MCP vive en
 * "<projectPath>/.article-mcp/project.json", y ese mismo directorio contiene
 * el artículo en Markdown, la biblioteca de referencias, figuras, datos, etc.
 * (ver markdown.js).
 *
 * Para poder resolver un projectId a su carpeta sin tener que recorrer todo
 * el disco, se mantiene un índice liviano en ~/.scientific-article-mcp/index.json
 * (solo metadatos: id -> projectPath). Ese índice NUNCA es la fuente de verdad
 * del contenido del artículo; solo sirve para encontrarlo.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { SECTION_KEYS } = require('./schema');

const BASE_DIR = path.join(os.homedir(), '.scientific-article-mcp');
const INDEX_FILE = path.join(BASE_DIR, 'index.json');
const GLOBAL_LIBRARY_FILE = path.join(BASE_DIR, 'global-library.json');

function ensureBaseDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

function expandPath(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

function metaPathFor(projectPath) {
  return path.join(projectPath, '.article-mcp', 'project.json');
}

function loadIndex() {
  ensureBaseDir();
  if (!fs.existsSync(INDEX_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveIndex(index) {
  ensureBaseDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/** Rellena campos que puedan faltar en proyectos guardados con una versión anterior del schema. */
function normalizeProject(project) {
  if (!project.bibliography) project.bibliography = {};
  if (typeof project.styleNotes !== 'string') project.styleNotes = '';
  for (const key of SECTION_KEYS) {
    if (!project.sections[key]) {
      project.sections[key] = { content: '', answers: {}, lastValidation: null, updatedAt: null };
    } else if (!project.sections[key].answers) {
      project.sections[key].answers = {};
    }
  }
  return project;
}

/** Busca si ya existe un proyecto guardado en esa carpeta (para no pisarlo por accidente). */
function findProjectAtPath(projectPath) {
  const resolved = expandPath(projectPath);
  const metaPath = metaPathFor(resolved);
  if (!fs.existsSync(metaPath)) return null;
  return normalizeProject(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
}

function createProject({ title, articleType = 'IMRaD', researchField = null, projectPath }) {
  if (!projectPath) {
    throw new Error('projectPath es obligatorio: se necesita la carpeta del disco donde se guardará el proyecto.');
  }
  const resolvedPath = expandPath(projectPath);
  fs.mkdirSync(resolvedPath, { recursive: true });

  const shortId = crypto.randomBytes(3).toString('hex');
  const id = `${slugify(title) || 'articulo'}-${shortId}`;

  const sections = {};
  for (const key of SECTION_KEYS) {
    sections[key] = { content: '', answers: {}, lastValidation: null, updatedAt: null };
  }

  const now = new Date().toISOString();
  const project = {
    id,
    title,
    articleType,
    researchField,
    projectPath: resolvedPath,
    createdAt: now,
    updatedAt: now,
    sections,
    bibliography: {},
    styleNotes: '',
  };

  saveProject(project);
  return project;
}

function getProject(id) {
  const index = loadIndex();
  const entry = index[id];
  if (!entry) return null;
  const metaPath = metaPathFor(entry.projectPath);
  if (!fs.existsSync(metaPath)) return null;
  return normalizeProject(JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
}

function saveProject(project) {
  project.updatedAt = new Date().toISOString();
  const metaDir = path.join(project.projectPath, '.article-mcp');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');

  const index = loadIndex();
  index[project.id] = {
    projectPath: project.projectPath,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  saveIndex(index);
  return project;
}

function listProjects() {
  const index = loadIndex();
  const list = [];
  for (const id of Object.keys(index)) {
    const entry = index[id];
    const metaPath = metaPathFor(entry.projectPath);
    if (!fs.existsSync(metaPath)) {
      list.push({
        id,
        title: entry.title,
        projectPath: entry.projectPath,
        missing: true,
        updatedAt: entry.updatedAt,
      });
      continue;
    }
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const completed = SECTION_KEYS.filter((k) => (data.sections[k]?.content || '').trim().length > 0).length;
    list.push({
      id: data.id,
      title: data.title,
      projectPath: data.projectPath,
      progress: `${completed}/${SECTION_KEYS.length} secciones con contenido`,
      updatedAt: data.updatedAt,
    });
  }
  return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Biblioteca global de referencias: vive fuera de cualquier proyecto puntual
 * (en BASE_DIR), para poder reutilizar referencias entre distintos artículos.
 */
function loadGlobalLibrary() {
  ensureBaseDir();
  if (!fs.existsSync(GLOBAL_LIBRARY_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_LIBRARY_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveGlobalLibrary(lib) {
  ensureBaseDir();
  fs.writeFileSync(GLOBAL_LIBRARY_FILE, JSON.stringify(lib, null, 2), 'utf-8');
}

function getGlobalReference(key) {
  return loadGlobalLibrary()[key] || null;
}

function listGlobalReferences() {
  return loadGlobalLibrary();
}

function upsertGlobalReference(key, { citation, bibtex = null, tags = [] }) {
  const lib = loadGlobalLibrary();
  const now = new Date().toISOString();
  lib[key] = {
    citation,
    bibtex: bibtex || null,
    tags,
    addedAt: lib[key]?.addedAt || now,
    updatedAt: now,
  };
  saveGlobalLibrary(lib);
  return lib[key];
}

module.exports = {
  createProject,
  getProject,
  saveProject,
  listProjects,
  findProjectAtPath,
  expandPath,
  getGlobalReference,
  listGlobalReferences,
  upsertGlobalReference,
  BASE_DIR,
};
