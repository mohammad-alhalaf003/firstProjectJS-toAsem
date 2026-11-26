const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\evidence\\m5\\m5-docs-data.json', 'utf8'));
const apiHtml = fs.readFileSync('C:\\projects\\firstProjectJS-toAsem\\api.html', 'utf8');
const documented = [];
for (const match of apiHtml.matchAll(/group:\s*'[^']+'\s*,\s*method:\s*'(\w+)'\s*,\s*path:\s*'([^']+)'/g)) {
  documented.push({ method: match[1], path: match[2] });
}
const official = new Set();
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const method of Object.keys(methods)) official.add(`${method.toUpperCase()} ${path}`);
}
const rows = documented.map(entry => ({ ...entry, inOfficialSpec: official.has(`${entry.method} ${entry.path}`) }));
const report = {
  generatedAt: new Date().toISOString(),
  sources: ['https://fakestoreapi.com/docs', 'https://fakestoreapi.com/docs-data', 'api.html'],
  specVersion: spec.info.version,
  apiHtmlEndpoints: rows.length,
  officialSpecEndpoints: official.size,
  missingFromOfficialSpec: rows.filter(row => !row.inOfficialSpec),
  allOfficial: [...official].sort(),
  endpointsUsedByApp: [
    'GET /products', 'GET /products/{id}', 'GET /products/categories',
    'GET /products/category/{category}', 'GET /users', 'POST /products',
    'PUT /products/{id}', 'DELETE /products/{id}', 'POST /auth/login', 'POST /carts'
  ]
};
console.log(JSON.stringify(report, null, 2));
const evidenceDir = 'C:\\projects\\firstProjectJS-toAsem\\evidence\\m5';
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(require('path').join(evidenceDir, 'api-docs-review.json'), JSON.stringify(report, null, 2));
