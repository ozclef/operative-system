/**
 * discover_apps.js
 *  - Busca repos públicos de 3 usuarios (bius, os-clef, ozclef)
 *  - Para cada repo intenta leer os-manifest.json
 *  - Si no existe, comprueba index.html y crea una entrada mínima
 *  - Genera apps.json local con la lista
 *
 * Uso:
 * 1) export GITHUB_TOKEN=xxxx  (opcional para subir privados / evitar rate limit)
 * 2) node discover_apps.js > apps.json
 */

const fetch = (...args) => import('node-fetch').then(m=>m.default(...args));
const USERS = ['bius','os-clef','ozclef'];
const OUTFILE = 'apps.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

async function ghFetch(path) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub error ${res.status} ${path}`);
  return res.json();
}

async function listUserRepos(user, page=1, per_page=100) {
  return await ghFetch(`/users/${user}/repos?per_page=${per_page}&page=${page}`);
}

function rawUrl(owner, repo, branch, path) {
  // genera URL raw para content público
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

async function tryGetManifest(owner, repo) {
  // prueba a leer contenido del archivo os-manifest.json en la rama default
  try {
    const repoInfo = await ghFetch(`/repos/${owner}/${repo}`);
    if(!repoInfo) return null;
    const branch = repoInfo.default_branch || 'main';
    const manifestUrl = `/repos/${owner}/${repo}/contents/os-manifest.json?ref=${branch}`;
    const content = await ghFetch(manifestUrl);
    if (!content || !content.content) return null;
    const txt = Buffer.from(content.content, 'base64').toString('utf8');
    return JSON.parse(txt);
  } catch (e) {
    return null;
  }
}

async function checkIndexHtml(owner, repo) {
  try {
    const repoInfo = await ghFetch(`/repos/${owner}/${repo}`);
    const branch = repoInfo.default_branch || 'main';
    const indexPath = `/repos/${owner}/${repo}/contents/index.html?ref=${branch}`;
    const content = await ghFetch(indexPath);
    if (!content) return null;
    return { url: rawUrl(owner, repo, branch, 'index.html') };
  } catch (e) {
    return null;
  }
}

async function discover() {
  const apps = [];
  for (const user of USERS) {
    let page = 1;
    while (true) {
      const repos = await listUserRepos(user, page);
      if (!repos || repos.length === 0) break;
      for (const r of repos) {
        try {
          const owner = r.owner.login;
          const name = r.name;
          const manifest = await tryGetManifest(owner, name);
          if (manifest) {
            // si el manifest tiene url relativa, convertir a raw URL
            const branch = r.default_branch || 'main';
            if (manifest.url && !manifest.url.startsWith('http')) {
              manifest.url = rawUrl(owner, name, branch, manifest.url.replace(/^\/+/,''));
            }
            if (manifest.icon && !manifest.icon.startsWith('http')) {
              manifest.icon = rawUrl(owner, name, branch, manifest.icon.replace(/^\/+/,''));
            }
            manifest.id = manifest.id || `${owner}-${name}`;
            apps.push(manifest);
            continue;
          }
          // si no hay manifest, checar index.html
          const idx = await checkIndexHtml(owner, name);
          if (idx) {
            apps.push({
              id: `${owner}-${name}`,
              name: `${name}`,
              icon: '',
              type: 'iframe',
              url: idx.url,
              embedAllowed: true,
              defaultWidth: 900,
              defaultHeight: 600,
              resizable: true,
              tags: []
            });
          }
        } catch (err) {
          console.warn('error repo', r.full_name, err.message);
        }
      }
      if (repos.length < 100) break;
      page++;
    }
  }
  return apps;
}

(async () => {
  const apps = await discover();
  // output a JSON pretty
  console.log(JSON.stringify(apps, null, 2));
})();
