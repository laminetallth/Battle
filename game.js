// ================== ANIME BATTLE ARENA — motore ==================
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const other = p => (p === 'L' ? 'B' : 'L');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
const COL = { L: ['#ff2e4d', '#ff8a9a', '#ffffff', '#ffd23f'], B: ['#2e8bff', '#8cc4ff', '#ffffff', '#00f0ff'] };

const CH = {};
ANIME.forEach(a => a.chars.forEach((c, i) => { CH[a.id + '-' + i] = { ...c, cid: a.id + '-' + i, a }; }));
const initials = n => n.replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* =================== AUDIO (sintetizzato, niente file) =================== */
const SFX = (() => {
  let ctx = null, master = null, nb = null;
  let muted = localStorage.getItem('aba_mute') === '1';
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination); } catch (e) {}
  };
  const ok = () => ctx && !muted;
  function tone(f1, f2, dur, type = 'sine', vol = .3, delay = 0) {
    if (!ok()) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, f1, f2, vol = .3, type = 'bandpass', delay = 0) {
    if (!ok()) return;
    if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + delay;
    s.buffer = nb; f.type = type; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .05);
  }
  return {
    init, get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem('aba_mute', muted ? '1' : '0'); return muted; },
    whoosh() { noise(.38, 300, 4500, .35); },
    boom() { tone(150, 32, .8, 'sine', .8); noise(.6, 900, 50, .55, 'lowpass'); },
    coin() { tone(988, null, .08, 'square', .1); tone(1319, null, .28, 'square', .1, .08); },
    raise() { tone(200, 900, .2, 'sawtooth', .16); noise(.22, 900, 6000, .22); tone(1319, null, .2, 'square', .07, .12); },
    card() { noise(.28, 2500, 400, .25); tone(660, 1320, .3, 'triangle', .16, .05); },
    turn(p) { const b = p === 'L' ? 300 : 420; tone(b, b * 2, .14, 'sawtooth', .14); tone(b * 1.5, b * 3, .22, 'square', .08, .1); noise(.3, 400, 3000, .15); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, null, .25, 'triangle', .22, i * .07)); },
    pass() { tone(400, 120, .25, 'square', .12); },
    fanfare() { [392, 523, 659, 784, 659, 784, 1047, 1047].forEach((f, i) => tone(f, null, i === 7 ? .9 : .3, 'sawtooth', .12, i * .13)); noise(1.2, 3000, 200, .12, 'bandpass', .9); },
    click() { tone(700, 350, .06, 'square', .06); },
  };
})();

/* =================== FX (canvas particelle / fulmini / onde) =================== */
const FX = (() => {
  const cv = $('#fx'), ctx = cv.getContext('2d');
  let W = 0, H = 0, running = false;
  const parts = [], rings = [], bolts = [];
  function resize() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', resize); resize();
  function loop() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.r += (r.max - r.r) * .11; r.life -= .03;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = r.life; ctx.strokeStyle = r.c; ctx.lineWidth = 2 + 12 * r.life;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= .07;
      if (b.life <= 0) { bolts.splice(i, 1); continue; }
      ctx.globalAlpha = b.life;
      for (const [w, c] of [[9 * b.life, b.c], [2.5, '#fff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath();
        b.pts.forEach(([x, y], k) => { const j = k && k < b.pts.length - 1 ? (Math.random() - .5) * 6 : 0; k ? ctx.lineTo(x + j, y + j) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      p.vx *= p.fr; p.vy = p.vy * p.fr + p.g; p.x += p.vx; p.y += p.vy;
      ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = ctx.strokeStyle = p.c;
      if (p.conf) {
        p.rot += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 2)); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      } else if (p.streak) {
        ctx.lineWidth = p.s * .7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.3, p.s * p.life), 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (parts.length || rings.length || bolts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
  return {
    burst(x, y, colors, n = 60, sp = 11) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = Math.random() * sp + 2;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: Math.random() * 4 + 2, c: colors[i % colors.length], life: 1, decay: Math.random() * .02 + .016, fr: .92, g: .12, streak: Math.random() < .55 });
      }
      kick();
    },
    ring(x, y, c, max = 300) { rings.push({ x, y, r: 8, max, c, life: 1 }); kick(); },
    bolt(x1, y1, x2, y2, c, amp = 70) {
      const pts = [], n = 16, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, off = i === 0 || i === n ? 0 : (Math.random() - .5) * amp * Math.sin(t * Math.PI);
        pts.push([x1 + dx * t - dy / len * off, y1 + dy * t + dx / len * off]);
      }
      bolts.push({ pts, c, life: 1 }); kick();
    },
    confetti(colors, n = 180) {
      for (let i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * .6, vx: (Math.random() - .5) * 3, vy: Math.random() * 3 + 2, s: Math.random() * 9 + 7, c: colors[i % colors.length], life: 1, decay: .0035, fr: .995, g: .04, conf: true, rot: Math.random() * 6, vr: (Math.random() - .5) * .25 });
      kick();
    },
  };
})();

/* =================== sfondo con braci =================== */
const BG = (() => {
  const cv = $('#bg'), ctx = cv.getContext('2d');
  let W, H, tint = ['#ff2e4d', '#2e8bff', '#ffd23f', '#ff3df2'];
  const em = [];
  function resize() { const d = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  resize(); addEventListener('resize', resize);
  const spawn = any => ({ x: Math.random() * W, y: any ? Math.random() * H : H + 10, r: Math.random() * 2 + .6, v: Math.random() * .9 + .25, w: Math.random() * 6.3, c: tint[(Math.random() * tint.length) | 0], a: Math.random() * .5 + .3 });
  const N = Math.min(80, Math.round((innerWidth * innerHeight) / 14000));
  for (let i = 0; i < N; i++) em.push(spawn(true));
  function loop() {
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
    for (const e of em) {
      e.y -= e.v; e.w += .02; e.x += Math.sin(e.w) * .45;
      if (e.y < -10) Object.assign(e, spawn(false));
      ctx.fillStyle = e.c;
      ctx.globalAlpha = e.a * .25; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, 7); ctx.fill();
      ctx.globalAlpha = e.a; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return { setTint(arr) { tint = arr; em.forEach((e, i) => { if (Math.random() < .7) e.c = arr[i % arr.length]; }); } };
})();

/* =================== utilità UI =================== */
function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function shake(el, small) { const c = small ? 'shake-s' : 'shake'; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); setTimeout(() => el.classList.remove(c), 500); }
function raysPulse() { const r = $('#rays'); r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

let bannerT;
function banner(html, cls, dur = 1100) {
  const b = $('#banner');
  b.className = ''; void b.offsetWidth;
  b.style.setProperty('--bd', dur + 'ms');
  b.querySelector('.bn-text').innerHTML = html;
  b.className = 'show ' + cls;
  clearTimeout(bannerT);
  bannerT = setTimeout(() => { b.className = ''; }, dur);
  return sleep(dur);
}

let screenNow = 'intro';
async function go(id) {
  const w = $('#wipe');
  w.classList.remove('on'); void w.offsetWidth; w.classList.add('on');
  SFX.whoosh();
  await sleep(380);
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  screenNow = id;
  document.body.classList.toggle('in-arena', id === 'arena');
  if (id !== 'arena') setTurnClass(null);
  await sleep(420);
  w.classList.remove('on');
}

function setTurnClass(p) {
  document.body.classList.remove('turn-L', 'turn-B', 'turn-none');
  document.body.classList.add(p ? 'turn-' + p : 'turn-none');
  BG.setTint(p ? COL[p].concat(['#ffd23f']) : ['#ff2e4d', '#2e8bff', '#ffd23f', '#ff3df2']);
}

/* ---------- immagini ---------- */
function applyImg(el, cid) {
  const url = IMG.get(cid);
  if (!url) return;
  const img = el.querySelector('img');
  if (!img || img.dataset.src === url) return;
  img.dataset.src = url;
  img.referrerPolicy = 'no-referrer';
  img.onload = () => el.classList.add('has-img');
  img.src = url;
}
addEventListener('imgready', e => { $$(`[data-cid="${e.detail.cid}"]`).forEach(el => applyImg(el, e.detail.cid)); });

function styleVars(a) { return `--c1:${a.c1};--c2:${a.c2};--glow:${a.glow}`; }
function phHTML(c) { return `<div class="ph"><span class="pk">${c.a.kanji}</span><span class="pi">${initials(c.n)}</span></div>`; }

function cardEl(cid, { back = false } = {}) {
  const c = CH[cid];
  const el = document.createElement('div');
  el.className = 'card' + (back ? ' back' : '');
  el.dataset.cid = cid;
  el.setAttribute('style', styleVars(c.a));
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-front"><div class="card-body">
        <div class="card-img">${phHTML(c)}<img alt="${c.n}" draggable="false"></div>
        <div class="holo"></div>
        <div class="card-tag">${c.a.name}</div>
        <div class="card-name">${c.n}</div>
        <div class="shine"></div>
      </div></div>
      <div class="card-back"><span>${c.a.kanji}</span></div>
    </div>
    <div class="chip"></div>`;
  applyImg(el, cid);
  // tilt 3D su desktop
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || el.classList.contains('back')) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    const inner = el.querySelector('.card-inner');
    inner.style.setProperty('--ry', x * 18 + 'deg'); inner.style.setProperty('--rx', -y * 18 + 'deg');
  });
  el.addEventListener('pointerleave', () => { const inner = el.querySelector('.card-inner'); inner.style.setProperty('--ry', '0deg'); inner.style.setProperty('--rx', '0deg'); });
  return el;
}

/* =================== STATO =================== */
let S = null;          // stato partita
let undoStack = [];
let busy = false;
let amt = 0;           // importo scelto nello stepper
const setup = { mode: 'classic', anime: null };

const SAVE = 'aba_save_v1';
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} };
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return null; } };
const snap = () => { undoStack.push(JSON.stringify(S)); if (undoStack.length > 40) undoStack.shift(); };

/* =================== INTRO =================== */
let introBolts = null;
function runIntro() {
  const cx = () => innerWidth / 2, cy = () => innerHeight * .42;
  setTimeout(() => {
    if (screenNow !== 'intro') return;
    const x = cx(), y = cy();
    flash();
    FX.burst(x, y, COL.L, 90, 18); FX.burst(x, y, COL.B, 90, 18); FX.burst(x, y, ['#ffd23f', '#fff'], 50, 24);
    FX.ring(x, y, '#ffffff', Math.max(innerWidth, innerHeight)); FX.ring(x, y, '#ffd23f', innerWidth * .6);
    for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 300; FX.bolt(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, i % 2 ? '#2e8bff' : '#ff2e4d', 90); }
    shake($('#intro'));
  }, 1200);
  // fulmini continui tra i due nomi
  setTimeout(() => {
    introBolts = setInterval(() => {
      if (screenNow !== 'intro') { clearInterval(introBolts); return; }
      const r = $('.iname.red'), b = $('.iname.blue');
      if (!r || !b) return;
      const a = center(r), c = center(b);
      FX.bolt(a.x + a.r.width / 2, a.y, c.x - c.r.width / 2, c.y, Math.random() < .5 ? '#ff2e4d' : '#2e8bff', 50);
      if (Math.random() < .35) { const v = center($('.ivs')); FX.burst(v.x, v.y, ['#ffd23f', '#fff'], 14, 6); }
    }, 650);
  }, 2700);
  $('#intro').addEventListener('click', () => {
    if (screenNow !== 'intro') return;
    SFX.init(); SFX.boom();
    clearInterval(introBolts);
    const x = innerWidth / 2, y = innerHeight / 2;
    FX.ring(x, y, '#ffd23f', innerWidth); FX.burst(x, y, ['#ffd23f', '#fff', '#ff2e4d', '#2e8bff'], 70, 16);
    renderSetup();
    go('setup');
  });
}

/* =================== SETUP =================== */
function renderSetup() {
  buildSetup();
  refreshSetup();
}
let setupBuilt = false;
function buildSetup() {
  if (setupBuilt) return; setupBuilt = true;
  const m = $('#modes');
  m.innerHTML = MODES.map((x, i) => `
    <button class="mode-card${setup.mode === x.id ? ' sel' : ''}" data-id="${x.id}" style="animation-delay:${i * 70}ms">
      <span class="mk">${x.kanji}</span><span class="mi">${x.icon}</span><h4>${x.name}</h4><p>${x.desc}</p>
    </button>`).join('');
  const a = $('#animes');
  a.innerHTML = ANIME.map((x, i) => `
    <button class="anime-tile${setup.anime === x.id ? ' sel' : ''}" data-id="${x.id}" style="${styleVars(x)};animation-delay:${200 + i * 50}ms">
      <span class="ak">${x.kanji}</span><span class="ac">${x.chars.length} PG</span><span class="an">${x.name}</span><span class="shine"></span>
    </button>`).join('') + '<div class="multi-note" hidden>∞ Multiverso: tutti gli anime mescolati insieme!</div>';
}
function refreshSetup() {
  $$('.mode-card').forEach(b => b.classList.toggle('sel', b.dataset.id === setup.mode));
  $$('.anime-tile').forEach(b => b.classList.toggle('sel', b.dataset.id === setup.anime));
  $('.multi-note').hidden = setup.mode !== 'multi';
  $('#animes').classList.toggle('off', setup.mode === 'multi');
  $('#animeStep').classList.toggle('off', setup.mode === 'multi');
  $('#startBtn').disabled = !(setup.mode === 'multi' || setup.anime);

  const sv = load();
  const r = $('#resume');
  if (sv && sv.phase === 'play') {
    r.hidden = false;
    const md = MODES.find(x => x.id === sv.mode);
    const an = sv.animeId ? ANIME.find(x => x.id === sv.animeId).name : 'tutti gli anime';
    $('#resumeInfo').textContent = ` ${md.name} · ${an} · Lamine ${sv.team.L.length}/4 – Bassirou ${sv.team.B.length}/4`;
  } else r.hidden = true;
}
$('#modes').addEventListener('click', e => {
  const b = e.target.closest('.mode-card'); if (!b) return;
  SFX.init(); SFX.click(); setup.mode = b.dataset.id;
  const c = center(b); FX.burst(c.x, c.y, ['#ffd23f', '#fff'], 24, 7);
  refreshSetup();
});
$('#animes').addEventListener('click', e => {
  const b = e.target.closest('.anime-tile'); if (!b) return;
  SFX.init(); SFX.card(); setup.anime = b.dataset.id;
  const an = ANIME.find(x => x.id === setup.anime);
  const c = center(b); FX.burst(c.x, c.y, [an.glow, an.c2, '#fff'], 40, 9); FX.ring(c.x, c.y, an.glow, 160);
  IMG.prefetch([an.id]);
  refreshSetup();
});
$('#startBtn').addEventListener('click', () => { SFX.init(); startGame(); });
$('#resume').addEventListener('click', async () => {
  SFX.init();
  S = load(); undoStack = [];
  if (!S) return;
  prefetchFor(S);
  await go('arena');
  renderHud(); renderModeLbl();
  if (S.auction) { renderAuction(false); showTurn(S.auction.turn); }
  else nextAuction();
});

function prefetchFor(st) {
  const ids = [];
  const all = st.pool.concat(st.auction ? st.auction.cards : [], st.team.L.map(t => t.cid), st.team.B.map(t => t.cid));
  (st.auction ? st.auction.cards : []).concat(st.pool).concat(all).forEach(cid => { const id = cid.split('-')[0]; if (!ids.includes(id)) ids.push(id); });
  IMG.prefetch(ids);
}

/* =================== PARTITA =================== */
async function startGame(cfg) {
  const mode = cfg ? cfg.mode : setup.mode, animeId = cfg ? cfg.animeId : (mode === 'multi' ? null : setup.anime);
  let pool;
  if (mode === 'multi') pool = shuffle(ANIME.flatMap(a => shuffle(a.chars.map((c, i) => a.id + '-' + i)).slice(0, 4)));
  else pool = shuffle(ANIME.find(a => a.id === animeId).chars.map((c, i) => animeId + '-' + i));
  S = { mode, animeId, coins: { L: START_COINS, B: START_COINS }, team: { L: [], B: [] }, pool, opener: null, round: 0, auction: null, phase: 'play' };
  undoStack = [];
  prefetchFor(S);
  await go('arena');
  renderHud(); renderModeLbl();
  $('#cards').innerHTML = ''; $('#cards').className = 'cards';
  updateUI();
  S.opener = await coinFlip();
  save();
  nextAuction();
}

function renderModeLbl() {
  $('#modeLbl').textContent = MODES.find(m => m.id === S.mode).name.toUpperCase();
}

async function coinFlip() {
  const ov = $('#coinflip'), coin = ov.querySelector('.flipcoin'), res = ov.querySelector('.cf-res');
  const r = Math.random() < .5 ? 'L' : 'B';
  res.textContent = ''; res.className = 'cf-res';
  ov.classList.add('show');
  const turns = 360 * 7 + (r === 'B' ? 180 : 0);
  coin.animate([
    { transform: 'translateY(0) rotateY(0deg) scale(1)' },
    { transform: `translateY(-70px) rotateY(${turns / 2}deg) scale(1.3)`, offset: .5 },
    { transform: `translateY(0) rotateY(${turns}deg) scale(1)` },
  ], { duration: 1700, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
  SFX.whoosh();
  await sleep(1700);
  SFX.boom(); vibrate(40);
  res.textContent = `APRE ${PLAYERS[r].name}!`; res.classList.add(r);
  const c = center(coin); FX.burst(c.x, c.y, COL[r], 90, 14); FX.ring(c.x, c.y, PLAYERS[r].color, 400); flash();
  await sleep(1300);
  ov.classList.remove('show');
  return r;
}

async function nextAuction() {
  const nL = S.team.L.length, nB = S.team.B.length;
  if (nL >= TEAM_SIZE && nB >= TEAM_SIZE) return endGame();
  if (nL >= TEAM_SIZE || nB >= TEAM_SIZE) return freeAssign(nL >= TEAM_SIZE ? 'B' : 'L');
  S.round++;
  const n = S.mode === 'three' ? Math.min(3, S.pool.length) : 1;
  const cards = S.pool.splice(0, n);
  S.auction = { cards, cur: null, turn: S.opener, locked: null, sel: n === 1 ? 0 : null };
  save();
  busy = true;
  await renderAuction(true);
  busy = false;
  showTurn(S.auction.turn);
}

async function renderAuction(animate) {
  const a = S.auction, box = $('#cards');
  box.innerHTML = '';
  box.className = 'cards' + (a.cards.length > 1 ? ' three' : '');
  $('#roundNo').textContent = S.round;
  const first = CH[a.cards[0]].a;
  $('#stageKanji').textContent = first.kanji;
  const els = a.cards.map((cid, i) => {
    const el = cardEl(cid, { back: animate });
    el.dataset.i = i;
    if (animate) { el.classList.add('drop'); el.style.animationDelay = i * 140 + 'ms'; }
    box.appendChild(el);
    return el;
  });
  updateUI();
  if (!animate) return;
  SFX.whoosh();
  await sleep(380 + (els.length - 1) * 140);
  for (const el of els) {
    el.classList.remove('back');
    SFX.card();
    const c = center(el);
    const an = CH[el.dataset.cid].a;
    FX.burst(c.x, c.y, [an.glow, an.c2, '#ffffff'], 46, 10); FX.ring(c.x, c.y, an.glow, c.r.width * 1.2);
    await sleep(170);
  }
  raysPulse();
  await sleep(350);
}

/* ---------- interazione carte (tre carte) ---------- */
$('#cards').addEventListener('click', e => {
  const el = e.target.closest('.card'); if (!el || !S || !S.auction || busy) return;
  const a = S.auction; if (a.cards.length < 2) return;
  const i = +el.dataset.i;
  if (a.turn === S.opener && a.locked !== null) { if (i !== a.locked) toast('🔒 Sei bloccato sulla tua carta'); return; }
  a.sel = i; SFX.click();
  const c = center(el); FX.burst(c.x, c.y, COL[a.turn], 20, 6);
  updateUI();
});

function bounds() {
  const a = S.auction, p = a.turn;
  const min = a.cur ? a.cur.amt + 1 : 0;
  return { min, max: S.coins[p] };
}

function updateUI() {
  renderCoins();
  const a = S && S.auction;
  const bb = $('#bidbox');
  if (!a) {
    $('#bidAmt').textContent = '—'; $('#bidWho').textContent = ''; bb.className = 'bidbox';
    $('#turnLbl').textContent = ''; $('#hint').textContent = '';
    $('#bidBtn').disabled = $('#passBtn').disabled = true; $('#stepper').classList.add('hide');
    $('#pL').className = 'pp red'; $('#pB').className = 'pp blue';
    $('#undoBtn').disabled = true;
    return;
  }
  const p = a.turn, three = a.cards.length > 1;
  setTurnClass(p);
  $('#pL').className = 'pp red ' + (p === 'L' ? 'active' : 'dim');
  $('#pB').className = 'pp blue ' + (p === 'B' ? 'active' : 'dim');
  $('#turnLbl').textContent = `TURNO DI ${PLAYERS[p].name}`;

  // box offerta
  if (a.cur) {
    $('#bidLbl').textContent = 'OFFERTA PIÙ ALTA';
    $('#bidAmt').textContent = a.cur.amt;
    $('#bidWho').textContent = PLAYERS[a.cur.p].name + (three ? ' → ' + CH[a.cards[a.cur.ci]].n : '');
    bb.className = 'bidbox ' + a.cur.p;
  } else {
    $('#bidLbl').textContent = 'APERTURA'; $('#bidAmt').textContent = 0; $('#bidWho').textContent = 'si parte da 0'; bb.className = 'bidbox';
  }

  // carte
  $$('#cards .card').forEach(el => {
    const i = +el.dataset.i, chip = el.querySelector('.chip');
    el.querySelectorAll('.lock').forEach(x => x.remove());
    if (a.cur && a.cur.ci === i) { chip.className = 'chip on ' + a.cur.p; chip.textContent = `${PLAYERS[a.cur.p].name} · ${a.cur.amt}`; }
    else { chip.className = 'chip'; }
    if (three) {
      const lockedMe = p === S.opener && a.locked !== null;
      el.classList.toggle('sel', a.sel === i);
      el.classList.toggle('nope', lockedMe && i !== a.locked);
      if (a.locked === i) { const l = document.createElement('div'); l.className = 'lock ' + S.opener; l.textContent = '🔒'; el.appendChild(l); }
    } else el.classList.remove('sel', 'nope');
  });
  $('#cards').classList.toggle('choosing', three && a.sel === null);

  // controlli
  const { min, max } = bounds();
  const opening = !a.cur;
  $('#stepper').classList.toggle('hide', opening);
  $('#passBtn').style.display = opening ? 'none' : '';
  $('#bidBtn').classList.toggle('solo', opening);
  let hint = '';
  if (opening) {
    $('#bidBtn').textContent = 'APRI A 0';
    $('#bidBtn').disabled = three && a.sel === null;
    hint = three ? (a.sel === null ? 'Scegli una delle tre carte e apri a 0' : 'Aprendo resterai bloccato su questa carta') : 'Apri l\'asta a 0 monete';
  } else {
    amt = Math.min(Math.max(amt, min), max);
    $('#amt').textContent = min > max ? '—' : amt;
    const can = min <= max;
    $('#bidBtn').disabled = !can || (three && a.sel === null);
    $('#bidBtn').textContent = can ? `RILANCIA ${amt}` : 'RILANCIA';
    $('#minus').disabled = !can || amt <= min;
    $('#plus').disabled = $('#plus5').disabled = $('#allin').disabled = !can || amt >= max;
    $('#passBtn').disabled = false;
    if (!can) hint = 'Monete insufficienti: puoi solo passare';
    else if (three && p === S.opener) hint = '🔒 Puoi rilanciare solo sulla tua carta';
    else if (three) hint = 'Tocca una carta per cambiare personaggio';
    else hint = `Rilancia da ${min} a ${max} monete o passa`;
  }
  $('#hint').textContent = hint;
  $('#undoBtn').disabled = !undoStack.length;
}

function renderCoins() {
  if (!S) return;
  $('#cL').textContent = S.coins.L; $('#cB').textContent = S.coins.B;
}

function renderHud(popP) {
  for (const p of ['L', 'B']) {
    const box = $('#s' + p);
    box.innerHTML = '';
    for (let i = 0; i < TEAM_SIZE; i++) {
      const t = S.team[p][i];
      const d = document.createElement('div');
      if (t) {
        const c = CH[t.cid];
        d.className = 'slot full' + (t.free ? ' free' : '') + (popP === p && i === S.team[p].length - 1 ? ' pop' : '');
        d.dataset.cid = t.cid; d.title = c.n;
        d.setAttribute('style', styleVars(c.a));
        d.innerHTML = `<span class="ini">${initials(c.n)}</span><img alt="">`;
        applyImg(d, t.cid);
      } else { d.className = 'slot'; d.textContent = i + 1; }
      box.appendChild(d);
    }
  }
  renderCoins();
}

/* ---------- turno ---------- */
function showTurn(p) {
  const a = S.auction; if (!a) return;
  const { min } = bounds();
  amt = min;
  updateUI();
  SFX.turn(p); vibrate(25);
  banner(`<small>${a.cur ? 'RILANCIA O PASSA' : (a.cards.length > 1 ? 'SCEGLI E APRI' : 'APRI L\'ASTA')}</small>${PLAYERS[p].name},<br>TOCCA A TE!`, p === 'L' ? 'red' : 'blue', 1150);
  const pp = center($('#p' + p)); FX.burst(pp.x, pp.y, COL[p], 30, 8);
}

/* ---------- stepper ---------- */
function setAmt(v) {
  const { min, max } = bounds();
  const n = Math.min(Math.max(v, min), max);
  if (n !== amt) { amt = n; SFX.click(); }
  updateUI();
  const el = $('#amt'); el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
}
$('#minus').addEventListener('click', () => setAmt(amt - 1));
$('#plus').addEventListener('click', () => setAmt(amt + 1));
$('#plus5').addEventListener('click', () => setAmt(amt + 5));
$('#allin').addEventListener('click', () => { setAmt(S.coins[S.auction.turn]); const c = center($('#allin')); FX.burst(c.x, c.y, ['#ffd23f', '#fff'], 30, 8); });

/* ---------- RILANCIA ---------- */
$('#bidBtn').addEventListener('click', async () => {
  if (busy || !S || !S.auction) return;
  const a = S.auction, p = a.turn, three = a.cards.length > 1;
  const opening = !a.cur;
  let ci;
  if (three) {
    if (p === S.opener && a.locked !== null) ci = a.locked;
    else { if (a.sel === null) return; ci = a.sel; }
  } else ci = 0;
  const value = opening ? 0 : amt;
  if (!opening) { const { min, max } = bounds(); if (value < min || value > max) return; }
  snap();
  a.cur = { amt: value, p, ci };
  if (opening && three) a.locked = ci;
  a.turn = other(p);
  a.sel = three ? (a.turn === S.opener ? a.locked : ci) : 0;
  save();
  busy = true;
  animRaise(p, value, opening, ci);
  updateUI();
  await sleep(420);
  busy = false;
  showTurn(a.turn);
});

function animRaise(p, value, opening, ci) {
  const b = $('#bidAmt'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  SFX.raise(); setTimeout(() => SFX.coin(), 120); vibrate([20, 30, 20]);
  const bc = center($('#bidbox'));
  const cc = center($('#coins' + p));
  FX.bolt(cc.x, cc.y, bc.x, bc.y, PLAYERS[p].color, 80);
  FX.bolt(cc.x, cc.y, bc.x, bc.y, '#ffffff', 40);
  FX.burst(bc.x, bc.y, COL[p], 50, 12); FX.ring(bc.x, bc.y, PLAYERS[p].color, 220);
  const card = $(`#cards .card[data-i="${ci}"]`);
  if (card) { const k = center(card); FX.ring(k.x, k.y, PLAYERS[p].color, k.r.width); }
  floatWord(opening ? 'APERTURA!' : (value >= S.coins[p] && value > 0 ? 'ALL IN!!' : `RILANCIO ${value}!`), p);
  shake($('#stage'), true); raysPulse();
}

function floatWord(txt, p, top = 40) {
  const st = $('#stage'), w = document.createElement('div');
  w.className = 'float-word ' + p; w.textContent = txt;
  w.style.left = (50 + (Math.random() - .5) * 20) + '%'; w.style.top = top + '%';
  w.style.setProperty('--rot', ((Math.random() - .5) * 18) + 'deg');
  st.appendChild(w); setTimeout(() => w.remove(), 1150);
}

/* ---------- PASSO ---------- */
$('#passBtn').addEventListener('click', async () => {
  if (busy || !S || !S.auction || !S.auction.cur) return;
  snap();
  const a = S.auction, passer = a.turn, win = a.cur.p, price = a.cur.amt, ci = a.cur.ci;
  const cid = a.cards[ci];
  S.coins[win] -= price;
  S.team[win].push({ cid, paid: price });
  const rest = a.cards.filter((_, i) => i !== ci);
  if (rest.length) { S.pool.push(...rest); shuffle(S.pool); }
  S.opener = other(S.opener);
  S.auction = null;
  save();
  busy = true;
  SFX.pass();
  floatWord('PASSO!', passer, 80);
  await sleep(450);
  await animWin(win, ci, price, rest.length > 0);
  busy = false;
  nextAuction();
});

async function animWin(p, ci, price, others) {
  const cards = $$('#cards .card');
  const card = cards.find(c => +c.dataset.i === ci);
  cards.forEach(c => { if (c !== card) c.classList.add('leave'); });
  $$('#cards .chip, #cards .lock').forEach(x => x.remove());
  setTurnClass(p);
  $('#controls').querySelectorAll('button').forEach(b => (b.disabled = true));
  if (others) toast('Le altre carte tornano nel mazzo');
  const st = document.createElement('div');
  st.className = 'stamp ' + p; st.textContent = price ? `CONQUISTATO! −${price}` : 'CONQUISTATO GRATIS!';
  card.appendChild(st);
  SFX.boom(); SFX.win(); vibrate([40, 40, 80]); flash();
  const c = center(card);
  FX.burst(c.x, c.y, COL[p], 110, 16); FX.ring(c.x, c.y, PLAYERS[p].color, 500); FX.ring(c.x, c.y, '#ffd23f', 300);
  shake($('#stage'));
  if (price) {
    const cc = center($('#coins' + p));
    const m = document.createElement('div'); m.className = 'minus-float'; m.textContent = '−' + price;
    m.style.left = cc.x - 20 + 'px'; m.style.top = cc.y - 10 + 'px'; document.body.appendChild(m); setTimeout(() => m.remove(), 1300);
    const el = $('#coins' + p); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  renderCoins();
  await sleep(950);
  await flyToSlot(card, p);
}

async function flyToSlot(card, p) {
  const idx = S.team[p].length - 1;
  renderHud(); // slot ancora vuoto visivamente? lo riempiamo dopo il volo
  const slot = $(`#s${p}`).children[idx];
  slot.style.visibility = 'hidden';
  const from = card.getBoundingClientRect(), to = slot.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.querySelectorAll('.stamp').forEach(x => x.remove());
  Object.assign(ghost.style, { position: 'fixed', left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', margin: 0, zIndex: 58, '--cw': from.width + 'px', animation: 'none' });
  document.body.appendChild(ghost);
  card.style.opacity = '0';
  SFX.whoosh();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sc = to.width / from.width;
  await ghost.animate([
    { transform: 'translate(0,0) scale(1) rotate(0)', filter: 'brightness(1)' },
    { transform: `translate(${dx * .4}px,${dy * .4 - 60}px) scale(${(1 + sc) / 2}) rotate(${p === 'L' ? -200 : 200}deg)`, filter: 'brightness(1.6)', offset: .5 },
    { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(${p === 'L' ? -360 : 360}deg)`, filter: 'brightness(2)' },
  ], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' }).finished;
  ghost.remove();
  slot.style.visibility = '';
  renderHud(p);
  const sc2 = center($(`#s${p}`).children[idx]);
  FX.burst(sc2.x, sc2.y, COL[p], 40, 8); FX.ring(sc2.x, sc2.y, PLAYERS[p].color, 90);
  SFX.coin();
  $('#cards').innerHTML = '';
}

/* ---------- assegnazione gratuita ---------- */
async function freeAssign(p) {
  busy = true;
  const full = other(p);
  const need = TEAM_SIZE - S.team[p].length;
  const picks = S.pool.splice(0, need);
  picks.forEach(cid => S.team[p].push({ cid, paid: 0, free: true }));
  S.auction = null; S.phase = 'end';
  save();
  updateUI();
  setTurnClass(p);
  await banner(`<small>SQUADRA COMPLETA</small>${PLAYERS[full].name} HA 4 PG!`, full === 'L' ? 'red' : 'blue', 1500);
  await banner(`<small>${need} PERSONAGG${need > 1 ? 'I' : 'IO'} IN REGALO</small>${PLAYERS[p].name} PESCA GRATIS!`, 'gold', 1400);
  const box = $('#cards');
  for (let k = 0; k < picks.length; k++) {
    const cid = picks[k];
    box.innerHTML = ''; box.className = 'cards';
    const el = cardEl(cid, { back: true }); el.dataset.i = 0; el.classList.add('drop');
    box.appendChild(el);
    await sleep(380);
    el.classList.remove('back'); SFX.card();
    const c = center(el); const an = CH[cid].a;
    FX.burst(c.x, c.y, [an.glow, '#ffd23f', '#fff'], 60, 12);
    await sleep(500);
    const st = document.createElement('div'); st.className = 'stamp free'; st.textContent = 'GRATIS!'; el.appendChild(st);
    SFX.win(); vibrate(30);
    await sleep(650);
    // volo verso lo slot corretto
    const idx = TEAM_SIZE - picks.length + k;
    await flyToSlotIdx(el, p, idx);
  }
  busy = false;
  await sleep(300);
  endGame();
}
async function flyToSlotIdx(card, p, idx) {
  // mostra temporaneamente solo gli slot fino a idx-1 come pieni
  const real = S.team[p];
  const saved = real.slice();
  S.team[p] = saved.slice(0, idx + 1);
  await flyToSlot(card, p);
  S.team[p] = saved;
}

/* =================== FINE =================== */
function score(p) { return S.team[p].reduce((s, t) => s + CH[t.cid].p, 0); }

async function endGame() {
  S.phase = 'end'; S.auction = null; save();
  await sleep(200);
  await banner('<small>L\'ASTA È CHIUSA</small>FINE PARTITA!', 'gold', 1300);
  await go('final');
  const sL = score('L'), sB = score('B');
  for (const p of ['L', 'B']) {
    $('#f' + p).innerHTML = S.team[p].map(t => {
      const c = CH[t.cid];
      return `<div class="mini" data-cid="${t.cid}" style="${styleVars(c.a)}">
        <div class="card-img" style="--cw:120px">${phHTML(c)}<img alt="${c.n}"></div>
        <span class="paid${t.paid ? '' : ' free'}">${t.paid ? t.paid + ' 🪙' : 'GRATIS'}</span>
        <div class="mn">${c.n}<small>${c.a.name}</small></div></div>`;
    }).join('');
    $$(`#f${p} .mini`).forEach(el => applyImg(el, el.dataset.cid));
    $('#fc' + p).textContent = S.coins[p];
    $('#fs' + p).textContent = 0;
    $('#team' + p).classList.remove('winner');
  }
  const v = $('#verdict'); v.className = 'verdict'; v.innerHTML = '';
  // rivelazione alternata
  for (let i = 0; i < TEAM_SIZE; i++) for (const p of ['L', 'B']) {
    const el = $$(`#f${p} .mini`)[i];
    if (!el) continue;
    el.classList.add('in'); SFX.card();
    const c = center(el); FX.burst(c.x, c.y, COL[p], 26, 7);
    await sleep(230);
  }
  // conteggio punteggi
  SFX.whoosh();
  await countUp($('#fsL'), sL); await countUp($('#fsB'), sB);
  await sleep(300);
  let w, note = '';
  if (sL !== sB) w = sL > sB ? 'L' : 'B';
  else if (S.coins.L !== S.coins.B) { w = S.coins.L > S.coins.B ? 'L' : 'B'; note = 'Parità di punteggio: decidono le monete rimaste!'; }
  else { w = 'D'; note = 'Stesso punteggio e stesse monete.'; }
  if (w === 'D') {
    v.className = 'verdict D'; v.innerHTML = `PAREGGIO!<small>${note}</small>`;
    FX.confetti(['#ff2e4d', '#2e8bff', '#ffd23f', '#fff']);
  } else {
    v.className = 'verdict ' + w; v.innerHTML = `VINCE ${PLAYERS[w].name}!${note ? `<small>${note}</small>` : ''}`;
    $('#team' + w).classList.add('winner');
    FX.confetti(COL[w].concat(['#ffd23f']));
    const c = center($('#team' + w)); FX.burst(c.x, c.y, COL[w], 120, 18); FX.ring(c.x, c.y, PLAYERS[w].color, 600);
  }
  flash(); SFX.boom(); SFX.fanfare(); vibrate([60, 60, 120]);
  setTimeout(() => { if (screenNow === 'final') FX.confetti(w === 'D' ? ['#ffd23f', '#fff'] : COL[w], 120); }, 2200);
}
function countUp(el, to) {
  return new Promise(res => {
    const t0 = performance.now(), d = 900;
    const f = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); else { SFX.coin(); res(); } };
    requestAnimationFrame(f);
  });
}

$('#againBtn').addEventListener('click', () => { SFX.init(); startGame({ mode: S.mode, animeId: S.animeId }); });
$('#menuBtn2').addEventListener('click', () => { SFX.init(); renderSetup(); go('setup'); });

/* =================== annulla / menu / audio =================== */
$('#undoBtn').addEventListener('click', () => {
  if (busy || !undoStack.length) return;
  S = JSON.parse(undoStack.pop());
  save(); SFX.whoosh();
  renderHud();
  if (S.auction) { renderAuction(false); amt = bounds().min; updateUI(); }
  toast('↶ Mossa annullata');
});
$('#menuBtn').addEventListener('click', () => {
  if (busy) return;
  if (!confirm('Tornare al menu? La partita resta salvata e potrai riprenderla.')) return;
  renderSetup(); go('setup');
});
function syncMute() { const t = SFX.muted ? '🔇' : '🔊'; $('#mute').textContent = t; $('#mute2').textContent = t; }
[$('#mute'), $('#mute2')].forEach(b => b.addEventListener('click', e => { e.stopPropagation(); SFX.init(); SFX.toggle(); syncMute(); }));
syncMute();

/* avvio */
runIntro();
})();
