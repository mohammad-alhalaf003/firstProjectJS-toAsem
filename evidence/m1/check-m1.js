const fs = require('fs');
const root = 'C:\\projects\\firstProjectJS-toAsem\\';
const html = fs.readFileSync(root + 'index.html', 'utf8');
const css = fs.readFileSync(root + 'style.css', 'utf8');
const js = fs.readFileSync(root + 'script.js', 'utf8');
const count = (re) => (html.match(re) || []).length;
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
const imgIssues = imgs.filter(tag => !/\balt=/.test(tag) || !/\bloading="lazy"/.test(tag) || !/\bwidth=/.test(tag) || !/\bheight=/.test(tag));
const buttonsNoType = [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]).filter(tag => !/\btype=/.test(tag));
const labelsNoFor = [...html.matchAll(/<label\b[^>]*>/g)].map(m => m[0]).filter(tag => !/\bfor=/.test(tag));
console.log(JSON.stringify({
  h1: count(/<h1\b/g),
  nav: count(/<nav\b/g),
  aside: count(/<aside\b/g),
  section: count(/<section\b/g),
  articleInTemplate: /<template[^>]*>[\s\S]*?<article\b/.test(html),
  dialogs: count(/<dialog\b/g),
  templates: count(/<template\b/g),
  categoryUl: /<ul class="chips" id="category-chips">/.test(html),
  footerUl: /<ul class="footer-links"/.test(html),
  duplicateIds: dup,
  htmlImages: imgs.length,
  htmlImageIssues: imgIssues,
  buttonsNoType,
  labelsNoFor,
  jsUsesTemplate: /product-card-template/.test(js),
  jsImgCalls: [...js.matchAll(/el\('img'[\s\S]{0,240}?\)\)/g)].map(m => m[0].replace(/\s+/g, ' ')),
  cssBraceCounts: [(css.match(/{/g) || []).length, (css.match(/}/g) || []).length]
}, null, 2));
