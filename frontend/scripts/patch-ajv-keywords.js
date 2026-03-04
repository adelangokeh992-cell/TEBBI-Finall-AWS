/**
 * Patch ALL copies of ajv-keywords _formatLimit.js under node_modules for ajv 8 (Node 24).
 * Both fork-ts-checker-webpack-plugin and babel-loader have nested ajv-keywords.
 */
const path = require('path');
const fs = require('fs');

const nodeModules = path.join(__dirname, '..', 'node_modules');
const needPatch = "var formats = ajv._formats;\n  for (var name in COMPARE_FORMATS)";
const patched   = "var formats = ajv._formats;\n  if (!formats) return;\n  for (var name in COMPARE_FORMATS)";

function findFormatLimitFiles(dir, files) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') findFormatLimitFiles(full, files);
      else if (e.name !== '.bin' && !e.name.startsWith('@')) findFormatLimitFiles(full, files);
    } else if (e.name === '_formatLimit.js') {
      const parent = path.basename(path.dirname(path.dirname(full)));
      if (parent === 'ajv-keywords') files.push(full);
    }
  }
}

const files = [];
findFormatLimitFiles(nodeModules, files);

let count = 0;
for (const targetFile of files) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes(needPatch) && !content.includes('if (!formats) return;')) {
    content = content.replace(needPatch, patched);
    fs.writeFileSync(targetFile, content);
    count++;
  }
}

if (count > 0) {
  console.log('patch-ajv-keywords: applied to', count, 'file(s) (ajv 8 compatibility).');
} else if (files.length > 0) {
  console.log('patch-ajv-keywords: already patched.');
} else {
  console.warn('patch-ajv-keywords: no _formatLimit.js found under node_modules. Skip.');
}
process.exit(0);
