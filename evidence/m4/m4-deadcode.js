const fs = require('fs');
const code = fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\script.js', 'utf8');
const names = new Set();
for (const match of code.matchAll(/\bfunction\s+(\w+)\s*\(/g)) names.add(match[1]);
for (const match of code.matchAll(/\bconst\s+(\w+)\s*=\s*(?:function|\()/g)) names.add(match[1]);
const unused = [];
for (const name of names) {
  const occurrences = (code.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
  if (occurrences <= 1) unused.push(name);
}
console.log(JSON.stringify({ totalFunctions: names.size, unused }, null, 2));
