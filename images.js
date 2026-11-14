// Foto dei personaggi: caricate a runtime nel browser dall'API pubblica Jikan (MyAnimeList).
// Nessuna immagine è salvata nel repo. Risultati in cache nel localStorage.
const IMG = (() => {
  const LS = 'aba_img_v2';
  const API = 'https://api.jikan.moe/v4';
  const GAP = 420; // Jikan: max ~3 richieste/secondo
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(cache)); } catch (e) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’`.]/g, '').replace(/uu/g, 'u').replace(/ou/g, 'o').replace(/oo/g, 'o');
  const toks = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  const isUrl = v => typeof v === 'string' && v.startsWith('http');
  const freshMiss = v => typeof v === 'string' && v[0] === '~' && Date.now() - +v.slice(1) < 3 * 864e5;
  const bad = u => !u || /questionmark|apple-touch|na\.gif/i.test(u);

  // coda seriale per rispettare il rate limit
  let chain = Promise.resolve();
  async function doFetch(path, n = 0) {
    const r = await fetch(API + path);
    if (r.status === 429 && n < 4) { await sleep(1300 * (n + 1)); return doFetch(path, n + 1); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function api(path) {
    const p = chain.then(() => doFetch(path));
    chain = p.catch(() => {}).then(() => sleep(GAP));
    return p;
  }

  const lists = {};
  function getList(malId) {
    if (!lists[malId]) {
      lists[malId] = api(`/anime/${malId}/characters`).then(j => (j.data || []).map(e => {
        const im = e.character.images || {};
        const url = (im.webp && im.webp.image_url) || (im.jpg && im.jpg.image_url);
        return { t: toks(e.character.name), url: bad(url) ? null : url, fav: e.favorites || 0, main: e.role === 'Main' };
      }).filter(e => e.url));
      lists[malId].catch(() => { delete lists[malId]; });
    }
    return lists[malId];
  }

  function best(entries, keyStr) {
    for (const alt of keyStr.split('|')) {
      const T = toks(alt);
      const c = entries.filter(e => T.every(t => e.t.includes(t)));
      if (c.length) {
        c.sort((a, b) => (b.fav + (b.main ? 5000 : 0)) - (a.fav + (a.main ? 5000 : 0)));
        return c[0].url;
      }
    }
    return null;
  }

  function emit(cid, url) {
    window.dispatchEvent(new CustomEvent('imgready', { detail: { cid, url } }));
  }

  const animeJobs = {};
  function resolveAnime(anime) {
    if (animeJobs[anime.id]) return animeJobs[anime.id];
    const job = (async () => {
      const todo = anime.chars.map((c, i) => ({ c, cid: anime.id + '-' + i })).filter(x => !isUrl(cache[x.cid]) && !freshMiss(cache[x.cid]));
      if (!todo.length) return;
      const res = await Promise.allSettled(anime.mal.map(getList));
      const ok = res.filter(r => r.status === 'fulfilled');
      if (!ok.length) throw new Error('offline');
      const entries = ok.flatMap(r => r.value);
      const missing = [];
      for (const x of todo) {
        const url = best(entries, x.c.k);
        if (url) { cache[x.cid] = url; emit(x.cid, url); } else missing.push(x);
      }
      save();
      // ricerca singola per chi non è stato trovato nelle liste della serie
      for (const x of missing) {
        try {
          const q = x.c.k.split('|')[0];
          const j = await api(`/characters?q=${encodeURIComponent(q)}&order_by=favorites&sort=desc&limit=10`);
          const entries2 = (j.data || []).map(e => {
            const im = e.images || {};
            const url = (im.webp && im.webp.image_url) || (im.jpg && im.jpg.image_url);
            return { t: toks(e.name), url: bad(url) ? null : url, fav: e.favorites || 0, main: false };
          }).filter(e => e.url);
          const url = best(entries2, x.c.k);
          cache[x.cid] = url || '~' + Date.now();
          if (url) emit(x.cid, url);
          save();
        } catch (e) { /* riprova la prossima volta */ }
      }
    })();
    animeJobs[anime.id] = job;
    job.catch(() => { delete animeJobs[anime.id]; });
    return job;
  }

  return {
    get: cid => (isUrl(cache[cid]) ? cache[cid] : undefined),
    prefetch(animeIds) {
      (async () => {
        for (const id of animeIds) {
          const a = ANIME.find(x => x.id === id);
          if (a) { try { await resolveAnime(a); } catch (e) {} }
        }
      })();
    },
  };
})();
