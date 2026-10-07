// 多源学术元数据解析（get-paper Step 0 的正式实现）：
//   resolveByTitle(title) → { doi, arxiv, venue, year, oaPdf, confidence, source } | null
//   authorPapers(name, {since}) → [{ title, year, doi, arxiv, venue, source }]
//
// 源与角色：
//   DBLP   — CS 领域精准（标题/作者匹配严格），首选
//   Semantic Scholar — 附带 openAccessPdf（可直接下载）
//   OpenAlex — 全学科覆盖最广，OA 链接丰富
//   Crossref — 兜底（单源时要求高相似度，防错配）
//
// 置信规则：≥2 源给出相同 DOI → high；单源但相似度 ≥0.9 → medium；否则 null（宁缺毋滥）。
import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join as pjoin, join } from 'node:path';

// 配置目录：遵循 XDG Base Directory（与 setup.sh 的 ${XDG_CONFIG_HOME:-~/.config}/get-paper 一致）
const CONF_DIR = pjoin(process.env.XDG_CONFIG_HOME || pjoin(homedir(), '.config'), 'get-paper');
const gpConf = name => pjoin(CONF_DIR, name);

const UA = 'get-paper/0.3 (https://github.com/morningD/ECNU-literature-quick-access)';
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Levenshtein-based similarity ratio (0..1)
function similarity(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  const m = A.length, n = B.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
  return 1 - dp[m][n] / Math.max(m, n);
}

const S2_KEY = (() => {
  try { return readFileSync(gpConf('s2_api_key.txt'), 'utf8').trim(); } catch { return ''; }
})();
// API key 单一来源：skill 自有配置文件（setup.sh 第 3 步写入，或手动放）。
//   OpenAlex key 池: ~/.config/get-paper/openalex_keys.txt（每行一个，# 注释）
//   S2 key:         ~/.config/get-paper/s2_api_key.txt
const OA_KEYS = (() => {
  try {
    return readFileSync(gpConf('openalex_keys.txt'), 'utf8')
      .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } catch { return []; }
})();
let oaKeySeq = 0;
const withOaKey = url => {
  if (!OA_KEYS.length) return url;
  const key = OA_KEYS[oaKeySeq++ % OA_KEYS.length];
  return url + (url.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(key);
};

async function getJSON(url, timeoutMs = 15000, retries = 1) {
  const headers = { 'User-Agent': UA };
  if (S2_KEY && url.includes('semanticscholar.org')) headers['x-api-key'] = S2_KEY;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) { clearTimeout(t); await new Promise(r => setTimeout(r, 3000)); continue; }
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch { if (attempt >= retries) return null; } finally { clearTimeout(t); }
  }
  return null;
}

// ---- 各源的单源查询：返回候选数组 [{title, doi, arxiv, venue, year, oaPdf, sim}] ----

async function fromDBLP(title) {
  const j = await getJSON(`https://dblp.org/search/publ/api?q=${encodeURIComponent(title)}&format=json&h=5`, 8000);
  const hits = j?.result?.hits?.hit;
  if (!hits) return [];
  return hits.map(h => {
    const info = h.info;
    const doi = info.doi || '';
    const ee = Array.isArray(info.ee) ? info.ee[0] : info.ee;
    const arxiv = (ee || '').match(/arxiv\.org\/(?:abs|pdf)\/([0-9v.]+)/i)?.[1] || '';
    return {
      title: info.title || '', doi, arxiv,
      venue: info.venue || '', year: +(info.year || 0),
      oaPdf: arxiv ? `https://arxiv.org/pdf/${arxiv}` : '',
      sim: similarity(title, info.title || ''),
      source: 'dblp',
    };
  });
}

async function fromS2(title) {
  const j = await getJSON(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&fields=title,year,venue,externalIds,openAccessPdf&limit=5`);
  return (j?.data || []).map(p => ({
    title: p.title || '', doi: p.externalIds?.DOI || '',
    arxiv: p.externalIds?.ArXiv || '',
    venue: p.venue || '', year: p.year || 0,
    oaPdf: p.openAccessPdf?.url || '',
    sim: similarity(title, p.title || ''),
    source: 's2',
  }));
}

async function fromOpenAlex(title) {
  const j = await getJSON(withOaKey(`https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=5&mailto=get-paper@example.com`));
  return (j?.results || []).map(w => {
    const doi = (w.doi || '').replace('https://doi.org/', '');
    const arxivFromDoi = /^10\.48550\/arxiv\.(.+)$/i.exec(doi)?.[1];
    const arxiv = ((w.ids?.arxiv || '').replace(/.*\/(?:abs\/)?/, '')
      || arxivFromDoi
      || (w.locations?.find(l => l.landing_page_url?.includes('arxiv.org'))?.landing_page_url.match(/abs\/([0-9v.]+)/)?.[1] ?? ''))
      .replace(/v\d+$/, '').replace(/^arxiv\.?\/*/i, '');
    return {
      title: w.display_name || '', doi, arxiv,
      venue: w.host_venue?.display_name || w.primary_location?.source?.display_name || '',
      year: w.publication_year || 0,
      oaPdf: w.best_oa_location?.pdf_url || '',
      sim: similarity(title, w.display_name || ''),
      source: 'openalex',
    };
  });
}

async function fromArxivWeb(title) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  const STOP = new Set(['a', 'an', 'the', 'of', 'for', 'in', 'on', 'to', 'and', 'with', 'as', 'via', 'toward', 'towards']);
  const words = title.replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w.toLowerCase())).slice(0, 8);
  if (words.length < 2) return [];
  try {
    const res = await fetch(`https://arxiv.org/search/?query=${encodeURIComponent(words.join(' '))}&searchtype=all&size=10`, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return [];
    const html = await res.text();
    const out = [];
    const blocks = html.split('<li class="arxiv-result">').slice(1);
    for (const b of blocks) {
      const id = b.match(/arxiv\.org\/abs\/([0-9.]+v?\d*)/)?.[1];
      const t = (b.match(/<p class="title is-5 mathjax">([\s\S]*?)<\/p>/)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (id && t) out.push({ title: t, doi: '10.48550/arxiv.' + id.replace(/v\d+$/, ''), arxiv: id.replace(/v\d+$/, ''), venue: 'arXiv', year: 0, oaPdf: '', sim: similarity(title, t), source: 'arxivweb' });
    }
    return out;
  } catch { return []; } finally { clearTimeout(t); }
}

async function fromCrossref(title) {
  const j = await getJSON(`https://api.crossref.org/works?rows=3&query.bibliographic=${encodeURIComponent(title)}`);
  return (j?.message?.items || []).map(it => ({
    title: (it.title || [''])[0], doi: it.DOI || '', arxiv: '',
    venue: (it['container-title'] || [''])[0] || '', year: +(it.issued?.['date-parts']?.[0]?.[0] || 0),
    oaPdf: '', sim: similarity(title, (it.title || [''])[0]),
    source: 'crossref',
  }));
}

const SIM_ACCEPT = 0.75;   // 单源候选接受的相似度门槛
const SIM_SOLO = 0.9;      // 仅单源时要求更高

/** 标题 → 元数据。多源并发 + 交叉验证。 */
export async function resolveByTitle(title, { sources = ['dblp', 's2', 'openalex', 'crossref', 'arxivweb'] } = {}) {
  const fns = { dblp: fromDBLP, s2: fromS2, openalex: fromOpenAlex, crossref: fromCrossref, arxivweb: fromArxivWeb };
  const lists = await Promise.all(sources.filter(s => fns[s]).map(s => fns[s](title)));
  const cands = lists.flat().filter(c => c.sim >= SIM_ACCEPT && (c.doi || c.arxiv));
  if (!cands.length) return null;

  // DOI 投票；arXiv DOI（10.48550/arxiv.X）与裸 arXiv id 折叠为同一键，避免票数分裂
  const key = c => {
    const m = (c.doi || '').match(/^10\.48550\/arxiv\.(.+)$/i);
    if (m) return `arxiv:${m[1].toLowerCase()}`;
    if (!c.doi && c.arxiv) return `arxiv:${c.arxiv.replace(/v\d+$/, '').toLowerCase()}`;
    return (c.doi || '').toLowerCase();
  };
  const votes = new Map();
  for (const c of cands) {
    const k = key(c);
    votes.set(k, (votes.get(k) || { n: 0, best: c, srcs: new Set() }));
    const v = votes.get(k);
    v.n++; v.srcs.add(c.source);
    if (c.sim > v.best.sim || (c.oaPdf && !v.best.oaPdf)) v.best = c;
  }
  const top = [...votes.values()].sort((a, b) => b.n - a.n || b.best.sim - a.best.sim)[0];
  const srcList = [...top.srcs];
  if (top.srcs.size >= 2) return { ...top.best, confidence: 'high', source: srcList.join('+') };
  // 单源仅信任严格源：DBLP 相似度≥0.85；S2 相似度≥0.95（此时结果须带 arXiv id）
  const b = top.best;
  if (top.srcs.has('dblp') && b.sim >= 0.85) return { ...b, confidence: 'medium', source: 'dblp' };
  if (top.srcs.has('s2') && b.sim >= 0.95 && b.arxiv) return { ...b, confidence: 'medium', source: 's2' };
  if (top.srcs.has('openalex') && b.sim >= 0.95) return { ...b, confidence: 'medium', source: 'openalex' };
  if (top.srcs.has('crossref') && b.sim >= 0.97) return { ...b, confidence: 'medium', source: 'crossref' }; // 精确匹配单源放行
  if (top.srcs.has('arxivweb') && b.sim >= 0.9) return { ...b, confidence: 'medium', source: 'arxivweb' };
  return null; // 其余单源一律拒绝（宁缺毋滥，防 Crossref/S2 式错配）
}

/** 学者名 → 论文列表（近 since 年）。DBLP 优先，OpenAlex 兜底。 */
export async function authorPapers(name, { since = 0 } = {}) {
  // DBLP：作者搜索 → 全部匹配 pid 的论文合并
  const aj = await getJSON(`https://dblp.org/search/author/api?q=${encodeURIComponent(name)}&format=json&h=10`);
  const hits = aj?.result?.hits?.hit;
  if (hits?.length) {
    const papers = [];
    for (const h of hits) {
      const info = h.info;
      if (similarity(name, info.author || '') < 0.6) continue;
      const pidUrl = info.url || ''; // https://dbl.org/pid/xx/yy.xml
      const pid = pidUrl.replace(/^https?:\/\/dblp\.org\/pid\//, '').replace(/\.xml$/, '');
      if (!pid || pid === pidUrl) continue;
      const pj = await getJSON(`https://dblp.org/pid/${pid}.json`);
      for (const p of pj?.person?.publication || []) {
        const rec = Array.isArray(p) ? p[0] : p;
        const info2 = rec.info || rec;
        const year = +(info2.year || 0);
        if (since && year && year < since) continue;
        const ee = Array.isArray(info2.ee) ? info2.ee[0] : info2.ee;
        papers.push({
          title: info2.title || '', year,
          doi: info2.doi || '',
          arxiv: (ee || '').match(/arxiv\.org\/(?:abs|pdf)\/([0-9v.]+)/i)?.[1] || '',
          venue: info2.venue || '', source: `dblp:${info.author}`,
        });
      }
      await sleep(800);
    }
    if (papers.length) {
      const seen = new Set();
      return papers.filter(p => { const k = norm(p.title); if (seen.has(k)) return false; seen.add(k); return true; });
    }
  }
  // OpenAlex（优先：作者消歧好，按 works_count 选最全档案）
  const au = await getJSON(withOaKey(`https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per-page=10&mailto=get-paper@example.com`));
  const bestAu = (au?.results || []).slice().sort((a, b) => (b.works_count || 0) - (a.works_count || 0))[0];
  if (bestAu?.id) {
    const shortId = bestAu.id.split('/').pop();
    const yearNow = new Date().getFullYear();
    const filter = since ? `author.id:${shortId},publication_year:${since}-${yearNow}` : `author.id:${shortId}`;
    const wj = await getJSON(withOaKey(`https://api.openalex.org/works?filter=${filter}&per-page=100&mailto=get-paper@example.com`));
    const papers = (wj?.results || []).map(w => ({
      title: w.display_name || '', year: w.publication_year || 0,
      doi: (w.doi || '').replace('https://doi.org/', ''),
      arxiv: '', venue: w.primary_location?.source?.display_name || '', source: 'openalex',
    }));
    if (papers.length) return papers;
  }
  // S2 作者兜底
  const sj = await getJSON(`https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(name)}`);
  const s2id = sj?.data?.[0]?.authorId;
  if (s2id) {
    const pj = await getJSON(`https://api.semanticscholar.org/graph/v1/author/${s2id}/papers?fields=title,year,venue,externalIds&limit=100`);
    const papers = (pj?.data || [])
      .filter(p => !since || !p.year || p.year >= since)
      .map(p => ({
        title: p.title || '', year: p.year || 0,
        doi: p.externalIds?.DOI || '', arxiv: p.externalIds?.ArXiv || '',
        venue: p.venue || '', source: 's2',
      }));
    if (papers.length) return papers;
  }
  return [];
}

/** DOI 直查（比标题匹配更准）：元数据 + OA PDF。 */
export async function resolveByDoi(doi) {
  const oa = await getJSON(withOaKey(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=get-paper@example.com`));
  if (oa?.id) {
    const arxivFromLoc = (oa.locations || []).find(l => l.landing_page_url?.includes('arxiv.org'))?.landing_page_url.match(/abs\/([0-9v.]+)/)?.[1] || '';
    const arxiv = (oa.ids?.arxiv || '').replace(/.*\/(?:abs\/)?/, '') || arxivFromLoc || (doi.startsWith('10.48550/arxiv.') ? doi.replace('10.48550/arxiv.', '') : '');
    return {
      title: oa.display_name || '', doi: (oa.doi || '').replace('https://doi.org/', '') || doi,
      arxiv: arxiv.replace(/v\d+$/, ''),
      venue: oa.primary_location?.source?.display_name || '',
      year: oa.publication_year || 0,
      oaPdf: oa.best_oa_location?.pdf_url || (arxiv ? `https://arxiv.org/pdf/${arxiv}` : ''),
      isOa: !!oa.open_access?.is_oa,
      source: 'openalex', confidence: 'high',
    };
  }
  // S2 by-DOI 兜底
  const s2 = await getJSON(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,year,venue,externalIds,openAccessPdf`);
  if (s2?.paperId) {
    return {
      title: s2.title || '', doi,
      arxiv: s2.externalIds?.ArXiv || '',
      venue: s2.venue || '', year: s2.year || 0,
      oaPdf: s2.openAccessPdf?.url || '',
      isOa: !!s2.openAccessPdf, source: 's2', confidence: 'high',
    };
  }
  return null;
}

/** 各源最佳候选（resolveByTitle 返回 null 时供人工挑选） */
export async function topCandidates(title) {
  const lists = await Promise.all([fromDBLP(title), fromS2(title), fromOpenAlex(title), fromCrossref(title), fromArxivWeb(title)]);
  const srcs = ['dblp', 's2', 'openalex', 'crossref', 'arxivweb'];
  return lists.map((l, i) => {
    const best = l.filter(c => c.sim >= 0.5).sort((a, b) => b.sim - a.sim)[0];
    return best ? { source: srcs[i], title: best.title.slice(0, 80), doi: best.doi, arxiv: best.arxiv, sim: best.sim } : null;
  }).filter(Boolean);
}

// ---- CLI（仅直接运行时执行；被 import 时不触发） ----
// 兼容 Windows 反斜杠与 POSIX 正斜杠两种 argv[1] 路径；i 覆盖 Windows 大小写不敏感
const IS_CLI = process.argv[1] && /[\\/]resolve\.mjs$/i.test(process.argv[1]);
if (!IS_CLI) {
  // no-op: imported as module
} else if (process.argv[2] === 'doi') {
  const r = await resolveByDoi(process.argv[3]);
  console.log(JSON.stringify(r, null, 1));
} else if (process.argv[2] === 'title') {
  const r = await resolveByTitle(process.argv[3]);
  if (r) console.log(JSON.stringify(r, null, 1));
  else {
    console.error('未解析到（宁缺毋滥）。各源最佳候选：');
    for (const c of await topCandidates(process.argv[3])) {
      console.error(`  [${c.source}] sim=${c.sim.toFixed(2)} ${c.doi || 'arXiv:' + c.arxiv}  ${c.title}`);
    }
    process.exit(1);
  }
} else if (process.argv[2] === 'author') {
  const since = process.argv.includes('--since') ? +(process.argv[process.argv.indexOf('--since') + 1]) : 0;
  const list = await authorPapers(process.argv[3], { since });
  console.log(JSON.stringify(list, null, 1));
} else {
  console.error('usage: resolve.mjs doi <DOI> | title "<title>" | author "<name>" [--since YEAR]');
  process.exit(2);
}
