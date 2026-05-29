import { preview as startPreview } from 'vite';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PHASE3_SMOKE_PORT || 4173);
const BASE_URL = `http://${HOST}:${PORT}`;

const ROUTES = [
  {
    path: '/',
    expected: ['login-form'],
  },
  {
    path: '/pages/dashboard.html',
    expected: ['id="match-list"', 'id="dash-standings-container"'],
  },
  {
    path: '/pages/details.html',
    expected: ['id="match-info"', 'id="player-list"'],
  },
  {
    path: '/pages/admin-placar.html',
    expected: ['id="adm-config"', 'id="adm-btn-iniciar"'],
  },
  {
    path: '/placar-ao-vivo.html',
    expected: ['pav-status'],
  },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch {
      // Preview is still booting.
    }
    await wait(250);
  }

  throw new Error(`Preview did not start at ${BASE_URL}`);
}

function extractAssetUrls(html) {
  const urls = new Set();
  const assetRegex = /(?:src|href)="([^"]+\.(?:js|css))"/g;
  let match;

  while ((match = assetRegex.exec(html)) !== null) {
    urls.add(match[1]);
  }

  return [...urls];
}

async function assertOk(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response;
}

async function checkRoute(route) {
  const response = await assertOk(`${BASE_URL}${route.path}`);
  const html = await response.text();

  route.expected.forEach((snippet) => {
    if (!html.includes(snippet)) {
      throw new Error(`${route.path} missing expected snippet: ${snippet}`);
    }
  });

  for (const asset of extractAssetUrls(html)) {
    if (asset.startsWith('http')) continue;
    await assertOk(`${BASE_URL}${asset.startsWith('/') ? asset : `/${asset}`}`);
  }

  console.log(`PHASE3_SMOKE_OK ${route.path}`);
}

function closePreviewServer(server) {
  return new Promise((resolve, reject) => {
    server.httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

const previewServer = await startPreview({
  preview: {
    host: HOST,
    port: PORT,
    strictPort: true,
  },
});

try {
  await waitForPreview();

  for (const route of ROUTES) {
    await checkRoute(route);
  }

  console.log('PHASE3_FLOW_SMOKE_OK');
} finally {
  await closePreviewServer(previewServer);
}
