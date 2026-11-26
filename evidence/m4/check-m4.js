const fs = require('fs');
const file = 'C:\\projects\\firstProjectJS-toAsem\\script.js';
const html = fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\index.html', 'utf8');
const code = fs.readFileSync(file, 'utf8');
const lines = code.split(/\r?\n/);
const results = [];

function check(name, ok, detail) {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
}
const has = (pattern) => pattern.test(code);
const count = (pattern) => (code.match(pattern) || []).length;

/* 4.1 Foundations */
check('4.1 const/let', count(/\bconst\s/g) > 10 && count(/\blet\s/g) >= 2, `const=${count(/\bconst\s/g)} let=${count(/\blet\s/g)}`);
check('4.1 data types', has(/Number\(|String\(|Array\.isArray|new Set\(|new Map\(|JSON\./), 'number/string/array/set/map/json');
check('4.1 template literals', count(/`/g) >= 20, `backticks=${count(/`/g)}`);
check('4.1 strict equality', count(/===/g) > 20 && !has(/[^=!]==[^=]/), `=== count=${count(/===/g)}`);
check('4.1 if + ternary', has(/\bif\s*\(/) && has(/\?\s*[^:]+\s*:/), 'both used');
check('4.1 for...of', count(/for\s*\(const\s+\w+\s+of\s/g) >= 2, `for...of=${count(/for\s*\(const\s+\w+\s+of\s/g)}`);
check('4.1 forEach', count(/\.forEach\(/g) >= 5, `forEach=${count(/\.forEach\(/g)}`);

/* 4.2 Functions */
check('4.2 declarations', count(/function\s+\w+\s*\(/g) > 30, `declarations=${count(/function\s+\w+\s*\(/g)}`);
check('4.2 function expressions', count(/const\s+\w+\s*=\s*function\s*\(/g) >= 2, `expressions=${count(/const\s+\w+\s*=\s*function\s*\(/g)}`);
check('4.2 arrow functions', count(/=>/g) > 20, `arrows=${count(/=>/g)}`);
check('4.2 default parameters', count(/=\s*\{\}|=\s*false|=\s*'success'/g) >= 4 && has(/function\s+createNode\(tag,\s*options\s*=\s*\{\}/), 'defaults in createNode/createBilingual/toast/renderCartBadge/apiRequest');
check('4.2 return values', count(/\breturn\b/g) > 20, `returns=${count(/\breturn\b/g)}`);
check('4.2 callbacks', count(/\.addEventListener\(/g) > 15, `listeners=${count(/\.addEventListener\(/g)}`);

/* 4.3 Arrays and objects */
check('4.3 map/filter/find/some/includes/reduce', ['map', 'filter', 'find', 'some', 'includes', 'reduce'].every((m) => has(new RegExp(`\\.${m}\\(`))), 'all six used');
check('4.3 spread', count(/\.\.\./g) >= 3, `spread/rest=${count(/\.\.\./g)}`);
check('4.3 destructuring', count(/\(\[\w+,\s*\w+\]\)/g) >= 2 || count(/\(\{\s*\w+/g) >= 1, `destructuring=${count(/\(\[\w+,\s*\w+\]\)/g)}`);

/* 4.4 Sorting */
check('4.4 Array.sort comparator', has(/\.sort\(compare\)/) && has(/const SORT_COMPARATORS/), 'named comparators for price/rating/title');
check('4.4 server sort preserved', has(/sort:\s*state\.idSort/) && has(/\?\$\{params\.toString\(\)\}/), '?sort= in URL');
check('4.4 no mutation of source', has(/state\.viewProducts\.slice\(\)/) && !has(/state\.viewProducts\.sort/), 'sort on copy');

/* 4.5 DOM */
check('4.5 querySelector(All)', has(/document\.querySelectorAll\(/) && has(/card\.querySelector\(/), 'both used');
check('4.5 createElement/append/textContent', has(/document\.createElement\(/) && has(/node\.append\(child\)/) && has(/textContent\s*=/), 'used');
check('4.5 no innerHTML with data', !has(/innerHTML\s*=/) && !has(/\.innerHTML/), `innerHTML occurrences in comments only=${count(/innerHTML/g)}`);
check('4.5 classList + dataset', has(/\.classList\./) && has(/\.dataset\./), 'both used');
check('4.5 product template kept', /id="product-card-template"/.test(html) && has(/product-card-template/), 'template cloned');

/* 4.6 Events */
check('4.6 click/input/submit/keydown', ['click', 'input', 'submit', 'keydown'].every((type) => has(new RegExp(`'${type}'`))), 'all four event types');
check('4.6 preventDefault', has(/event\.preventDefault\(\)/), 'submit handled');
check('4.6 Escape', has(/event\.key === 'Escape'/), 'Escape closes menu');
check('4.6 grid delegation', has(/grid\.addEventListener\('click',\s*handleProductGridClick/) && has(/event\.target\.closest\('\[data-action\]'\)/) && /data-action=/.test(html) && has(/card\.dataset\.id\s*=/), 'one listener + data-action/dataset.id/closest');
check('4.6 no per-card listeners', !has(/media\.addEventListener|fav\.addEventListener|add\.addEventListener|card\.addEventListener/), 'cards have no listeners');

/* 4.7 State/render/errors */
check('4.7 one state object', count(/const state\s*=\s*\{/g) === 1, 'single state');
check('4.7 render function', has(/function renderProducts\(\)/) && has(/function renderApp\(\)/), 'clear render functions');
check('4.7 try/catch/finally', has(/try\s*\{/) && has(/catch\s*\(/) && has(/finally\s*\{/), 'all present');
check('4.7 response.ok', has(/return \{ ok: response\.ok/), 'checked');
check('4.7 console.*', ['console.log', 'console.info', 'console.warn', 'console.error'].every((m) => code.includes(m)), 'log/info/warn/error used');

/* Q1–Q7 */
// Mask comments, strings, template literals and regexes so only real code is inspected.
function maskNonCode(source) {
  let output = '';
  let mode = 'code';
  let braceDepth = 0;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (mode === 'code') {
      if (character === '/' && next === '/') { while (index < source.length && source[index] !== '\n') index++; continue; }
      if (character === '/' && next === '*') { index += 2; while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++; index += 2; continue; }
      const previous = output.replace(/\s+$/, '').slice(-1);
      if (character === '/' && (previous === '' || '(,=[:!?&|{;'.includes(previous))) { mode = 'regex'; output += ' '; index++; continue; }
      if (character === "'" || character === '"' || character === '`') { mode = character; output += ' '; index++; continue; }
      output += character; index++; continue;
    }
    if (mode === 'regex') {
      if (character === '\\') { output += '  '; index += 2; continue; }
      if (character === '/') { mode = 'code'; output += ' '; index++; continue; }
      output += character === '\n' ? '\n' : ' '; index++; continue;
    }
    if (mode === '`') {
      if (character === '\\') { output += '  '; index += 2; continue; }
      if (character === '$' && next === '{') { mode = 'expression'; braceDepth = 1; output += '  '; index += 2; continue; }
      if (character === '`') { mode = 'code'; output += ' '; index++; continue; }
      output += character === '\n' ? '\n' : ' '; index++; continue;
    }
    if (mode === "'" || mode === '"') {
      if (character === '\\') { output += '  '; index += 2; continue; }
      if (character === mode) { mode = 'code'; output += ' '; index++; continue; }
      output += character === '\n' ? '\n' : ' '; index++; continue;
    }
    if (character === '{') braceDepth++;
    if (character === '}') { braceDepth--; if (braceDepth === 0) mode = '`'; }
    output += character; index++;
  }
  return output;
}
const maskedCode = maskNonCode(code);
const shortNames = new Set();
let nameMatch = null;
const declarationPattern = /\b(?:const|let|var)\s+([a-z])\b/g;
const functionNamePattern = /\bfunction\s+([a-z])\s*\(/g;
const paramPattern = /\bfunction\s+\w+\s*\(([^)]*)\)|(\(([^()]*)\))\s*=>/g;
while ((nameMatch = declarationPattern.exec(maskedCode))) shortNames.add(nameMatch[1]);
while ((nameMatch = functionNamePattern.exec(maskedCode))) shortNames.add(nameMatch[1]);
while ((nameMatch = paramPattern.exec(maskedCode))) {
  const parameterList = nameMatch[1] || nameMatch[3] || '';
  for (const parameter of parameterList.split(',')) {
    const clean = parameter.trim().replace(/^\.{3}/, '');
    if (/^[a-z]$/.test(clean)) shortNames.add(clean);
  }
}
const singleLetters = [...shortNames];
check('Q1 no single-letter names', singleLetters.length === 0, `found: ${singleLetters.join(', ') || 'none'}`);
const functions = [];
lines.forEach((line, index) => {
  const match = line.match(/function\s+(\w+)\s*\(/);
  if (match) functions.push({ name: match[1], line: index + 1 });
});
const undocumented = functions.filter((entry) => {
  const previous = lines[entry.line - 2] || '';
  const own = lines[entry.line - 1] || '';
  return !/^\s*(\/\/|\/\*|\*)/.test(previous) && !/\/\*/.test(own);
});
check('Q4 one-line comment per function', undocumented.length === 0, `undocumented: ${undocumented.map((u) => u.name).join(', ') || 'none'}`);
check('Q6 file order', code.indexOf('const BASE_URL') < code.indexOf('function createNode') && code.indexOf('const state =') < code.indexOf('function renderProducts') && code.indexOf('function init') > code.indexOf('setupControls'), 'constants → helpers → state → render → events → startup');
check('Q7 no misleading TODO/FIXME', !/\bTODO\b|\bFIXME\b|\bstuff\b/i.test(code), 'no vague notes');

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((result) => result.status === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
