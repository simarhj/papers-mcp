/**
 * store.js
 * Persistencia simple basada en archivos JSON, uno por proyecto.
 * Ubicación: ~/.scientific-article-mcp/projects/<id>.json
 * Esto permite que el "contexto" del artículo sobreviva entre sesiones distintas
 * de Claude Desktop, ya que el servidor MCP se reinicia con cada sesión.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { SECTION_KEYS } = require('./schema');

const BASE_DIR = path.join(os.homedir(), '.scientific-article-mcp');
const PROJECTS_DIR = path.join(BASE_DIR, 'projects');

function ensureDirs() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function projectPath(id) {
  return path.join(PROJECTS_DIR, `${id}.json`);
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function createProject({ title, articleType = 'IMRaD', researchField = null }) {
  ensureDirs();
  const shortId = crypto.randomBytes(3).toString('hex');
  const id = `${slugify(title) || 'articulo'}-${shortId}`;

  const sections = {};
  for (const key of SECTION_KEYS) {
    sections[key] = {
      content: '',
      lastValidation: null,
      updatedAt: null,
    };
  }

  const project = {
    id,
    title,
    articleType,
    researchField,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections,
  };

  fs.writeFileSync(projectPath(id), JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

function getProject(id) {
  ensureDirs();
  const p = projectPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveProject(project) {
  ensureDirs();
  project.updatedAt = new Date().toISOString();
  fs.writeFileSync(projectPath(project.id), JSON.stringify(project, null, 2), 'utf-8');
  return project;
}

function listProjects() {
  ensureDirs();
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
      const completed = SECTION_KEYS.filter((k) => (data.sections[k]?.content || '').trim().length > 0).length;
      return {
        id: data.id,
        title: data.title,
        articleType: data.articleType,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        progress: `${completed}/${SECTION_KEYS.length} secciones con contenido`,
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function deleteProject(id) {
  const p = projectPath(id);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

module.exports = {
  createProject,
  getProject,
  saveProject,
  listProjects,
  deleteProject,
  PROJECTS_DIR,
};
