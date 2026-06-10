const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PAGE_URL = 'https://www.bacplus.ro/top-licee/bucuresti';
const OUTPUT_FILE = path.join(__dirname, 'data.json');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCommaNumber(str) {
  if (!str || str.trim() === '') return null;
  return parseFloat(str.replace(',', '.'));
}

function extractTdContent(tdString) {
  const endIdx = tdString.indexOf('</td>');
  if (endIdx < 0) return '';
  return tdString.substring(0, endIdx);
}

function parseHTML(html) {
  const rows = html.match(/<tr[^>]*>[\s\S]{0,2500}?<\/tr>/g) || [];
  const schools = [];

  rows.forEach((row) => {
    // Split by <td tags to get each cell
    const tdParts = row.split(/<td[^>]*>/);

    // tdParts[1] = rank, [2] = name+img, [3] = medieBac, [4] = medieAdm, [5] = promovare SVG, [6] = candidati
    if (tdParts.length < 7) return;

    const rank = parseInt(tdParts[1].split('</td>')[0].trim());
    const hrefMatch = tdParts[2].match(/href="\/i\/([^"]+)"/);
    const siiirMatch = tdParts[2].match(/institutii\/(\d+)\/sigla-xs/);

    if (!hrefMatch || !siiirMatch) return;

    const name = decodeURIComponent(hrefMatch[1].replace(/-/g, ' '));
    const medieBac = parseCommaNumber(extractTdContent(tdParts[3]));
    const medieAdm = parseCommaNumber(extractTdContent(tdParts[4]));

    // Extract promovare percentage from SVG div
    const promovareContent = extractTdContent(tdParts[5]);
    const pctMatch = promovareContent.match(/\>\s*(\d+),?(\d*)\s*<!--/);
    const rataPromovare = pctMatch ? parseCommaNumber(pctMatch[1] + (pctMatch[2] ? ',' + pctMatch[2] : '')) : null;

    // Extract numCandidati
    const candidates = extractTdContent(tdParts[6]).trim();
    const numCandidati = candidates ? parseInt(candidates) : null;

    schools.push({
      nume: name,
      siiir: siiirMatch[1],
      medieBac: medieBac,
      medieAdm: medieAdm,
      rataPromovare: rataPromovare,
      numCandidati: numCandidati,
      hasMap: false,
      rank: rank
    });
  });

  return schools;
}

async function generate() {
  console.log('Se descarca datele de pe bacplus.ro ...');
  const html = await fetchUrl(PAGE_URL);
  const schools = parseHTML(html);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schools, null, 2), 'utf-8');
  console.log('Salvat ' + schools.length + ' licee in data.json');
}

generate().catch((err) => {
  console.error('Eroare:', err.message);
  process.exit(1);
});
