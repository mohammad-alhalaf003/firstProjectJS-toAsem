const fs = require('fs');
const file = process.argv[2] || 'C:\\projects\\firstProjectJS-toAsem\\style.css';
const source = fs.readFileSync(file, 'utf8');

const definitions = [];
let selector = '';
for (const line of source.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.endsWith('{')) selector = trimmed.slice(0, -1).trim();
  else if (trimmed === '}') selector = '';
  const match = trimmed.match(/^(--[\w-]+)\s*:/);
  if (match) definitions.push({ name: match[1], selector });
}

const names = definitions.map((entry) => entry.name);
const used = [...source.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
const duplicatesInSameScope = [];
const seen = new Set();
for (const entry of definitions) {
  const key = `${entry.selector}::${entry.name}`;
  if (seen.has(key)) duplicatesInSameScope.push(entry.name);
  seen.add(key);
}
const rootNames = new Set(definitions.filter((entry) => entry.selector === ':root').map((entry) => entry.name));
const themeOverrides = [...new Set(definitions
  .filter((entry) => /^\[data-theme=/.test(entry.selector) && rootNames.has(entry.name))
  .map((entry) => entry.name))];
const undefinedNames = [...new Set(used.filter((name) => !names.includes(name)))];

console.log(JSON.stringify({
  definedTotal: definitions.length,
  definedUnique: new Set(names).size,
  usedUnique: new Set(used).size,
  undefined: undefinedNames,
  duplicatesInSameScope: [...new Set(duplicatesInSameScope)],
  themeOverrides: themeOverrides.length,
  themeOverrideNames: themeOverrides
}, null, 2));
