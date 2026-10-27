// Playwright for every tool, from the engine's own install (engine/node_modules, made by ../setup.sh).
const path = require('path');
for (const p of [path.join(__dirname, '..', 'node_modules', 'playwright'), 'playwright']) {
  try { module.exports = require(p); return; } catch (e) {}
}
throw new Error('Playwright is not installed. Run bash setup.sh once, from the folder that holds it.');
