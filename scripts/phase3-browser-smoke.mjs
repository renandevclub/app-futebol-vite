import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { preview as startPreview } from 'vite';

const execFileAsync = promisify(execFile);

const HOST = '127.0.0.1';
const PORT = Number(process.env.PHASE3_BROWSER_SMOKE_PORT || 4174);
const BASE_URL = `http://${HOST}:${PORT}`;

const ROUTES = [
  {
    path: '/',
    expectedAny: ['login-form'],
  },
  {
    path: '/pages/dashboard.html',
    expectedAny: ['match-list', 'login-form'],
  },
  {
    path: '/pages/details.html',
    expectedAny: ['match-info', 'login-form', 'details-container'],
  },
  {
    path: '/pages/admin-placar.html',
    expectedAny: ['adm-config', 'login-form'],
  },
  {
    path: '/placar-ao-vivo.html',
    expectedAny: ['pav-status'],
  },
];

const BROWSER_CANDIDATES =
  process.platform === 'win32'
    ? [
        process.env.PHASE3_BROWSER_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : [
        process.env.PHASE3_BROWSER_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ];

function findBrowserPath() {
  return BROWSER_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
}

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

async function dumpRouteDom(browserPath, profileDir, route) {
  const { stdout } = await execFileAsync(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      `--user-data-dir=${profileDir}`,
      '--virtual-time-budget=2000',
      '--dump-dom',
      `${BASE_URL}${route.path}`,
    ],
    {
      timeout: 20000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    },
  );

  return stdout;
}

function assertBrowserDom(route, html) {
  if (!html.includes('<html') || html.includes('ERR_CONNECTION') || html.includes('ERR_FAILED')) {
    throw new Error(`${route.path} did not load valid browser DOM`);
  }

  const hasExpectedSnippet = route.expectedAny.some((snippet) => html.includes(snippet));
  if (!hasExpectedSnippet) {
    throw new Error(`${route.path} missing browser DOM snippet: ${route.expectedAny.join(' | ')}`);
  }
}

const browserPath = findBrowserPath();
if (!browserPath) {
  throw new Error('No Edge/Chrome browser found for phase 3 browser smoke test.');
}

const profileRoot = process.env.PHASE3_BROWSER_PROFILE_ROOT || join(process.cwd(), '.tmp');
await mkdir(profileRoot, { recursive: true });
const profileDir = await mkdtemp(join(profileRoot, 'fm-phase3-browser-'));
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
    const html = await dumpRouteDom(browserPath, profileDir, route);
    assertBrowserDom(route, html);
    console.log(`PHASE3_BROWSER_OK ${route.path}`);
  }

  console.log('PHASE3_BROWSER_SMOKE_OK');
} finally {
  await closePreviewServer(previewServer);
  await rm(profileDir, { recursive: true, force: true });
}
