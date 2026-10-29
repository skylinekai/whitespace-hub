// Installs the carbon platform's Python packages during `npm install` (used on Render's Node runtime).
// Never fails the build: if Python isn't available, the hub still runs and explains what's missing.
const { spawnSync } = require('child_process');
const path = require('path');
if (process.env.SKIP_CARBON_PIP) process.exit(0);
const root = path.join(__dirname, '..');
const target = path.join(root, 'carbon', '.pydeps');
const req = path.join(root, 'carbon', 'requirements.txt');
const py = ['python3', 'python'].find(p => spawnSync(p, ['--version']).status === 0);
if (!py) { console.log('[carbon] Python not found, so the carbon platform will not run on this service. Use the Docker setup (render.yaml).'); process.exit(0); }
console.log(`[carbon] Installing Python packages with ${py} into carbon/.pydeps …`);
const r = spawnSync(py, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-cache-dir', '--upgrade', '--target', target, '-r', req], { stdio: 'inherit' });
console.log(r.status === 0 ? '[carbon] Python packages installed.' : '[carbon] Could not install Python packages; the carbon platform will not start. Use the Docker setup (render.yaml).');
process.exit(0);
