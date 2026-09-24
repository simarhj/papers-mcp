const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

async function callTool(client, name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.map((c) => c.text).join('\n');
  console.log(`\n=== ${name}(${JSON.stringify(args)}) ===`);
  console.log(text);
  return text;
}

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '..', 'src', 'index.js')],
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('Tools registrados:', tools.tools.map((t) => t.name).join(', '));

  const createRes = await callTool(client, 'create_article', {
    title: 'Efecto del microplástico en larvas de coral',
    researchField: 'biología marina',
  });
  const idMatch = createRes.match(/projectId:\s*([a-z0-9-]+)/i);
  const projectId = idMatch[1];
  console.log('\nprojectId extraído:', projectId);

  await callTool(client, 'get_section_guidance', { projectId, section: 'introduction' });

  // Introducción DELIBERADAMENTE incompleta (sin objetivo) para probar que la validación lo detecte
  await callTool(client, 'submit_section_content', {
    projectId,
    section: 'introduction',
    content:
      'Los microplásticos son fragmentos menores a 5mm que contaminan los océanos. ' +
      'Estudios previos han demostrado que afectan a peces e invertebrados. ' +
      'Sin embargo, pocos estudios han examinado su efecto específico en larvas de coral, ' +
      'lo que representa una brecha relevante dado el papel de los corales en los ecosistemas marinos.',
  });

  // Métodos con buen contenido
  await callTool(client, 'submit_section_content', {
    projectId,
    section: 'methods',
    content:
      'Se utilizó un diseño experimental controlado en laboratorio. La muestra consistió en 200 larvas ' +
      'de Acropora cervicornis obtenidas de un criadero certificado. El procedimiento consistió en exponer ' +
      'a los grupos experimentales a concentraciones de 0, 10 y 50 partículas/L de microplástico de polietileno ' +
      'durante 72 horas. El análisis estadístico se realizó mediante ANOVA de una vía usando el software R, ' +
      'con un nivel de significancia de 0.05.',
  });

  await callTool(client, 'get_project_status', { projectId });

  await callTool(client, 'validate_full_article', { projectId });

  await callTool(client, 'list_articles', {});

  await client.close();
  console.log('\n✅ Flujo de prueba completado sin errores.');
}

main().catch((err) => {
  console.error('❌ Error en prueba e2e:', err);
  process.exit(1);
});
