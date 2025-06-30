import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// Define simple templates here for now
// In a real app, these might be stored as actual template files/directories in the project
// or fetched from a configuration.

interface ProjectTemplate {
  files: Record<string, string>; // filePath: fileContent
}

const templates: Record<string, ProjectTemplate> = {
  'vanilla-js': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vanilla JS Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, Vanilla JS!</h1>
  <script src="script.js"></script>
</body>
</html>`,
      'style.css': `body {
  font-family: sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
  background-color: #f0f0f0;
}
h1 {
  color: #333;
}`,
      'script.js': `console.log('Hello from script.js!');
// Your JavaScript code here`,
    },
  },
  'basic-node': {
    files: {
      'package.json': `{
  "name": "basic-node-app",
  "version": "1.0.0",
  "description": "A basic Node.js application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.17.1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}`,
      'server.js': `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello from Basic Node.js App!');
});

app.listen(port, () => {
  console.log(\`Server listening at http://localhost:\${port}\`);
});`,
      '.gitignore': `node_modules\n.env`,
    },
  },
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { projectName, templateName } = payload as { projectName?: string; templateName?: string };

  if (!projectName || typeof projectName !== 'string' || projectName.trim() === '') {
    return json({ error: 'Project name is required' }, { status: 400 });
  }
  if (!templateName || typeof templateName !== 'string' || !templates[templateName]) {
    return json({ error: 'Valid template name is required' }, { status: 400 });
  }

  const selectedTemplate = templates[templateName];
  const generatedFiles: Record<string, string> = {};

  for (const [filePath, content] of Object.entries(selectedTemplate.files)) {
    // Prepend project name to file paths to simulate a project directory
    // The client-side logic will handle how these paths are structured in Yjs/file tree
    generatedFiles[`${projectName}/${filePath}`] = content;
  }

  // In a real scenario, you might also create a root project directory
  // or add a marker file like a .projectmeta
  // For now, the client will receive a flat map of "projectName/path/to/file": "content"

  return json({ projectName, templateName, files: generatedFiles });
}

// To provide a list of available templates to the frontend, you might add a loader function
export async function loader() {
  return json({ availableTemplates: Object.keys(templates) });
}
