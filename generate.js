const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const TOP_URL = 'https://www.bacplus.ro/top-licee/bucuresti';
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

function parseTopPage(html) {
  const rows = html.match(/<tr[^>]*>[\s\S]{0,2500}?<\/tr>/g) || [];
  const schools = [];

  rows.forEach((row) => {
    const tdParts = row.split(/<td[^>]*>/);
    if (tdParts.length < 7) return;

    const rank = parseInt(tdParts[1].split('</td>')[0].trim());
    const hrefMatch = tdParts[2].match(/href="\/i\/([^"]+)"/);
    const siiirMatch = tdParts[2].match(/institutii\/(\d+)\/sigla-xs/);

    if (!hrefMatch || !siiirMatch) return;

    const name = decodeURIComponent(hrefMatch[1].replace(/-/g, ' '));
    const medieBac = parseCommaNumber(extractTdContent(tdParts[3]));
    const medieAdm = parseCommaNumber(extractTdContent(tdParts[4]));

    const promovareContent = extractTdContent(tdParts[5]);
    const pctMatch = promovareContent.match(/\>\s*(\d+),?(\d*)\s*<!--/);
    const rataPromovare = pctMatch ? parseCommaNumber(pctMatch[1] + (pctMatch[2] ? ',' + pctMatch[2] : '')) : null;

    const candidates = extractTdContent(tdParts[6]).trim();
    const numCandidati = candidates ? parseInt(candidates) : null;

    schools.push({
      nume: name,
      slug: hrefMatch[1],
      siiir: siiirMatch[1],
      medieBac: medieBac,
      medieAdm: medieAdm,
      rataPromovare: rataPromovare,
      numCandidati: numCandidati,
      rank: rank,
      profiluri: []
    });
  });

  return schools;
}

function parseSchoolPage(html, school) {
  // Group rows: <tr><td class="text-left">NAME</td><td class="font-medium pr-8!">MEDIE</td><td class="pr-8!">COUNT</td></tr>
  const groupRows = html.match(/<tr><td class="text-left">([^<]+)<\/td><td class="font-medium pr-8!">([^<]+)<\/td><td class="pr-8!">([^<]+)<\/td><\/tr>/g) || [];

  // Profile rows: <tr><td class="text-left pr-8!">NAME</td><td class="pr-8!">MEDIE</td><td class="font-medium pr-8!">COUNT</td></tr>
  const profileRows = html.match(/<tr><td class="text-left pr-8!">([^<]+)<\/td><td class="pr-8!">([^<]+)<\/td><td class="font-medium pr-8!">([^<]+)<\/td><\/tr>/g) || [];

  // Class rows: <td class="text-left pr-8!">a XII-a X</td><td class="font-medium pr-8!">MEDIE</td><td class="text-right pr-8!">COUNT</td>
  const classRows = html.match(/<td class="text-left pr-8!">a XII-a ([A-Z])<\/td><td class="font-medium pr-8!">([^<]+)<\/td><td class="text-right pr-8!">([^<]+)<\/td><\/tr>/g) || [];

  const groups = [];
  groupRows.forEach((row) => {
    const match = row.match(/text-left">([^<]+)<\/td><td class="font-medium pr-8!">([^<]+)<\/td><td class="pr-8!">([^<]+)<\/td>/);
    if (match) {
      groups.push({
        nume: match[1],
        medieAdm: parseCommaNumber(match[2]),
        locuri: parseInt(match[3])
      });
    }
  });

  const profiluri = [];
  profileRows.forEach((row) => {
    const match = row.match(/text-left pr-8!">([^<]+)<\/td><td class="pr-8!">([^<]+)<\/td><td class="font-medium pr-8!">([^<]+)<\/td>/);
    if (match) {
      profiluri.push({
        nume: match[1],
        medieAdm: parseCommaNumber(match[2]),
        locuri: parseInt(match[3]),
        grupe: []
      });
    }
  });

  // Add class data to profiles (round-robin assignment based on position)
  let profileIdx = 0;
  classRows.forEach((row) => {
    const match = row.match(/a XII-a ([A-Z])<\/td><td class="font-medium pr-8!">([^<]+)<\/td><td class="text-right pr-8!">([^<]+)<\/td>/);
    if (match && profiluri.length > 0) {
      const targetProfile = profiluri[profileIdx % profiluri.length];
      targetProfile.grupe.push({
        grupa: match[1],
        medieAdm: parseCommaNumber(match[2]),
        locuri: parseInt(match[3])
      });
      profileIdx++;
    }
  });

  school.profiluri = {
    grupuri: groups,
    profiluri: profiluri
  };

  return school;
}

async function processSchool(school) {
  try {
    const url = 'https://www.bacplus.ro/i/' + school.slug;
    const html = await fetchUrl(url);
    parseSchoolPage(html, school);
    console.log('  OK: ' + school.nume);
  } catch (err) {
    console.log('  ERR: ' + school.nume + ' - ' + err.message);
    school.profiluri = { grupuri: [], profiluri: [] };
  }
}

function tryGitPush() {
  return new Promise((resolve) => {
    const steps = [
      { cmd: 'git add .' },
      { cmd: 'git commit -m "data generation"' },
      { cmd: 'git push' }
    ];

    function runStep(index) {
      if (index >= steps.length) {
        resolve();
        return;
      }

      exec(steps[index].cmd, (err) => {
        if (err) {
          console.log('  Git (' + steps[index].cmd + ': ' + err.message);
        }
        runStep(index + 1);
      });
    }

    runStep(0);
  });
}

async function generate() {
  console.log('1. Se descarca lista de licee...');
  const topHtml = await fetchUrl(TOP_URL);
  const schools = parseTopPage(topHtml);
  console.log('   Gasit ' + schools.length + ' licee');

  console.log('2. Se descarca profilurile pentru fiecare liceu...');
  const CONCURRENCY = 3;

  for (let i = 0; i < schools.length; i += CONCURRENCY) {
    const batch = schools.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processSchool));
    const pct = Math.round(((i + batch.length) / schools.length) * 100);
    console.log('   Progres: ' + pct + '% (' + (i + batch.length) + '/' + schools.length + ')');
  }

  const generatedAt = new Date().toISOString();
  schools.generatedAt = generatedAt;

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schools, null, 2), 'utf-8');
  console.log('\nSalvat ' + schools.length + ' licee in data.json');
  console.log('Data generarii: ' + new Date(generatedAt).toLocaleString('ro-RO'));

  console.log('3. Se incearca push-ul in Git...');
  try {
    await tryGitPush();
    console.log('  Git push terminat.');
  } catch (err) {
    console.log('  Git push a esuat (ignorare non-critica).');
  }
}

generate().catch((err) => {
  console.error('Eroare:', err.message);
  process.exit(1);
});
