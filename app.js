// app.js — HPNY 2026 (Năm Ngọ)
// - Thiệp + lời chúc + gửi lời chúc (Firestore + EmailJS)
// - Mở khóa “Nhận lộc” sau khi gửi lời chúc
// - Mini game: Nhập ngân hàng -> Vòng quay -> Lắc quẻ
// - Giữ theme đỏ đô (không nền đen)

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function pad2(n){
  n = Math.max(0, Number(n||0));
  return String(n).padStart(2, '0');
}

function removeDiacritics(str){
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hashStringFNV1a(str){
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function formatMoneyVND(amount){
  const n = Math.round(Number(amount||0));
  if (!Number.isFinite(n) || n <= 0) return '0đ';
  return n.toLocaleString('vi-VN') + 'đ';
}

// ===== Countdown (Tết 2026) =====
const TET_TARGET_MS = new Date('2026-02-17T00:00:00+07:00').getTime();

function initCountdown(){
  const elBig = { d: $('cdDays'), h: $('cdHours'), m: $('cdMinutes'), s: $('cdSeconds') };
  const elMini1 = { d: $('cdMiniDays'), h: $('cdMiniHours'), m: $('cdMiniMinutes'), s: $('cdMiniSeconds') };
  const elMini2 = { d: $('cdMiniDays2'), h: $('cdMiniHours2'), m: $('cdMiniMinutes2'), s: $('cdMiniSeconds2') };

  function setNum(el, val, pad=false){
    if (!el) return;
    el.textContent = pad ? pad2(val) : String(Math.max(0, val));
  }

  function tick(){
    const now = Date.now();
    let diff = TET_TARGET_MS - now;
    if (!Number.isFinite(diff)) diff = 0;

    if (diff <= 0){
      [elBig, elMini1, elMini2].forEach(g => {
        setNum(g.d, 0);
        setNum(g.h, 0, true);
        setNum(g.m, 0, true);
        setNum(g.s, 0, true);
      });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const minutes = Math.floor(diff / (1000 * 60)) % 60;
    const seconds = Math.floor(diff / 1000) % 60;

    [elBig, elMini1, elMini2].forEach(g => {
      setNum(g.d, days);
      setNum(g.h, hours, true);
      setNum(g.m, minutes, true);
      setNum(g.s, seconds, true);
    });
  }

  tick();
  setInterval(tick, 1000);
}

// ===== Decorative petals =====
function initPetals(){
  const container = $('petals');
  if (!container) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const COUNT = Math.min(28, Math.max(16, Math.floor(window.innerWidth / 55)));
  container.innerHTML = '';

  for (let i = 0; i < COUNT; i++){
    const p = document.createElement('div');
    p.className = 'petal';

    const x = Math.floor(Math.random() * 100);
    const drift = (Math.random() * 30 - 15);
    const dur = (12 + Math.random() * 12);
    const rot = (Math.random() * 720 - 360);
    const delay = -(Math.random() * dur);
    const size = 12 + Math.random() * 14;

    p.style.setProperty('--x', x + 'vw');
    p.style.setProperty('--drift', drift + 'vw');
    p.style.setProperty('--dur', dur + 's');
    p.style.setProperty('--rot', rot + 'deg');
    p.style.left = x + 'vw';
    p.style.top = '-12vh';
    p.style.animationDelay = delay + 's';
    p.style.width = size + 'px';
    p.style.height = size + 'px';

    container.appendChild(p);
  }
}

// ===== Fireworks FX =====
const fx = $('fx');
const ctx = fx ? fx.getContext('2d') : null;
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let CW = 0, CH = 0;

let particles = [];
let lastPointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.35 };
let autoFire = true;
let autoTimer = 0;

const COLOR_POOL = [
  'rgba(255,204,77,0.95)',
  'rgba(255,231,153,0.95)',
  'rgba(255,255,255,0.95)',
  'rgba(255,90,120,0.95)',
  'rgba(180,0,24,0.95)'
];

function resizeFx(){
  if (!fx || !ctx) return;
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  CW = Math.floor(window.innerWidth * DPR);
  CH = Math.floor(window.innerHeight * DPR);
  fx.width = CW;
  fx.height = CH;
  fx.style.width = '100vw';
  fx.style.height = '100vh';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function burst(x, y, count = 110){
  if (!ctx) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) count = Math.min(40, count);

  lastPointer = { x, y };

  for (let i = 0; i < count; i++){
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 5;
    const vx = Math.cos(a) * sp;
    const vy = Math.sin(a) * sp;

    particles.push({
      x, y,
      vx, vy,
      g: 0.06 + Math.random() * 0.08,
      life: 0,
      maxLife: 38 + Math.random() * 26,
      r: 1.2 + Math.random() * 2.2,
      col: COLOR_POOL[(Math.random() * COLOR_POOL.length) | 0]
    });
  }
}

function stepFx(){
  if (!ctx) return;

  ctx.fillStyle = 'rgba(43,0,8,0.18)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const next = [];
  for (const p of particles){
    p.life += 1;
    const t = p.life / p.maxLife;

    p.x += p.vx;
    p.y += p.vy;

    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + p.g;

    const alpha = Math.max(0, 1 - t);
    ctx.beginPath();
    ctx.fillStyle = p.col.replace(/0\.95\)$/, alpha.toFixed(3) + ')');
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    if (p.life < p.maxLife && p.x > -50 && p.x < window.innerWidth + 50 && p.y > -50 && p.y < window.innerHeight + 80){
      next.push(p);
    }
  }

  particles = next;

  if (autoFire){
    autoTimer += 1;
    if (autoTimer % 55 === 0){
      const x = 80 + Math.random() * (window.innerWidth - 160);
      const y = 90 + Math.random() * (window.innerHeight * 0.35);
      burst(x, y, 80 + ((Math.random() * 70) | 0));
    }
  }

  requestAnimationFrame(stepFx);
}

window.addEventListener('resize', () => { resizeFx(); initPetals(); });
window.addEventListener('pointerdown', (e) => { burst(e.clientX, e.clientY, 120); });

// ===== Music =====
const music = $('music');
const btnMusic = $('btnMusic');
const btnPrev = $('btnPrev');
const btnNext = $('btnNext');
const musicSelect = $('musicSelect');
const tapAudio = $('tapAudio');

let PLAYLIST = [];
let trackIndex = 0;
let musicOn = false;

function setMusicButton(state, label){
  const ico = btnMusic?.querySelector('.ico');
  const txt = btnMusic?.querySelector('.txt');
  if (!ico || !txt) return;

  if (label){
    ico.textContent = '❗';
    txt.textContent = label.replace(/^❗\s*/, '');
    return;
  }

  if (state){ ico.textContent = '⏸'; txt.textContent = 'Tạm dừng'; }
  else { ico.textContent = '▶️'; txt.textContent = 'Phát nhạc'; }
}

async function loadPlaylist(){
  try{
    const res = await fetch('./music/playlist.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Cannot load music/playlist.json');
    PLAYLIST = await res.json();
    if (!Array.isArray(PLAYLIST) || !PLAYLIST.length) throw new Error('playlist.json trống');

    if (musicSelect){
      musicSelect.innerHTML = PLAYLIST.map((t, i) => `<option value="${i}">${escapeHtml(t.title)}</option>`).join('');
    }
    trackIndex = 0;
    setTrack(0, false);
  }catch(e){
    console.warn(e);
    PLAYLIST = [];
    if (musicSelect) musicSelect.innerHTML = `<option value="">(Không có nhạc)</option>`;
    setMusicButton(false, '❗ Chưa có nhạc');
  }
}

function setTrack(i, autoplay = true){
  if (!PLAYLIST.length || !music) return;
  trackIndex = (i + PLAYLIST.length) % PLAYLIST.length;
  if (musicSelect) musicSelect.value = String(trackIndex);
  music.src = `./music/${PLAYLIST[trackIndex].file}`;
  music.volume = 0.9;
  if (musicOn && autoplay){
    music.play().catch(() => {});
  }
}

function showTapOverlay(){ tapAudio?.classList.remove('hidden'); }
function hideTapOverlay(){ tapAudio?.classList.add('hidden'); }

async function tryPlayFromGesture(){
  if (!PLAYLIST.length || !music) return false;
  try{
    if (!music.src) setTrack(trackIndex, false);
    await music.play();
    musicOn = true;
    setMusicButton(true);
    hideTapOverlay();
    return true;
  }catch(e){
    console.warn(e);
    return false;
  }
}

async function toggleMusic(){
  if (!PLAYLIST.length){
    setMusicButton(false, '❗ Chưa có nhạc');
    return;
  }

  if (!musicOn){
    const ok = await tryPlayFromGesture();
    if (!ok){
      showTapOverlay();
      setMusicButton(false);
      return;
    }
    burst(window.innerWidth * 0.5, window.innerHeight * 0.25, 140);
  }else{
    music.pause();
    musicOn = false;
    setMusicButton(false);
  }
}

btnMusic?.addEventListener('click', toggleMusic);
btnPrev?.addEventListener('click', () => setTrack(trackIndex - 1, true));
btnNext?.addEventListener('click', () => setTrack(trackIndex + 1, true));
musicSelect?.addEventListener('change', (e) => {
  const i = parseInt(e.target.value, 10);
  if (!Number.isNaN(i)) setTrack(i, true);
});
tapAudio?.addEventListener('click', async () => {
  const ok = await tryPlayFromGesture();
  if (ok) burst(window.innerWidth * 0.5, window.innerHeight * 0.25, 120);
});

// ===== UI refs =====
const lock = $('lock');
const statusEl = $('status');
const chip = $('chip');
const badge = $('badge');
const subLine = $('subLine');

const selectWrap = $('selectWrap');
const selectBtn = $('selectBtn');
const selectText = $('selectText');
const menu = $('menu');
const menuList = $('menuList');
const search = $('search');

const pass = $('pass');
const btnUnlock = $('btnUnlock');
const btnOwnerView = $('btnOwnerView');
const btnOwnerReplay = $('btnOwnerReplay'); // sẽ ẩn
const btnHint = $('btnHint');
const btnLogout = $('btnLogout');

const btnOwnerLogin = $('btnOwnerLogin');
const btnOwnerLogout = $('btnOwnerLogout');
const btnOwnerDashboard = $('btnOwnerDashboard');

const wishMsg = $('wishMsg');
const btnSendWish = $('btnSendWish');

const ownerModal = $('ownerModal');
const ownerBody = $('ownerBody');
const btnCloseOwner = $('btnCloseOwner');
const btnTabViews = $('btnTabViews');
const btnTabWishes = $('btnTabWishes');
const btnRefreshOwner = $('btnRefreshOwner');
let ownerTab = 'views';

const viewerName = $('viewerName');
const btnWish = $('btnWish');
const wishEl = $('wish');
const avatarImg = $('avatarImg');

const successPage = $('successPage');
const btnSuccessClose = $('btnSuccessClose');
const btnSuccessLuck = $('btnSuccessLuck');

const yearText = $('yearText');
const yearInput = $('yearInput');
const defaultYear = new Date().getFullYear();

const btnOpenLuck = $('btnOpenLuck');
const gameLockHintTop = $('gameLockHintTop');

// ===== Year input =====
yearText.textContent = String(defaultYear);
yearInput.value = String(defaultYear);
yearInput.addEventListener('input', () => {
  const v = yearInput.value.replace(/[^\d]/g, '').slice(0, 4);
  yearInput.value = v;
  if (v) yearText.textContent = v;
});

// ===== Wishes data (GIỮ NGUYÊN) =====
const GLOBAL_WISHES = [ /* ... giữ nguyên mảng của bạn ... */ 
  "Chúc {name} năm {year} luôn bình an và được yêu thương thật nhiều 💖",
  "May {year} bring you calm days and bright nights, {name}. ✨",
  "{year}년에는 {name}님에게 행복이 가득하길 바라요 🌸",
  "Năm {year} chúc {name} mọi điều tốt đẹp tự tìm đến! 🍀",
  "Wishing you a year full of gentle wins, {name}. 💪",
  "{name}님, {year}년은 웃음이 더 많아지는 한 해가 되길 😊",
  "Chúc {name} {year} tiền vào như nước, tiền ra nhỏ giọt thôi nha 💰😄",
  "New year, new energy—go shine, {name}! 🌟",
  "{year}년, {name}님 꿈이 하나씩 이루어지길 🎯",
  "Năm {year} chúc {name} sức khỏe dồi dào, tinh thần lúc nào cũng sáng! 🔋",
  "May your {year} be full of good surprises, {name}. 🎁",
  "{name}님, {year}년엔 좋은 사람들과 좋은 일만 가득하길 🫶",
  "Chúc {name} {year} mọi deadline đều qua nhẹ như lông hồng ⏳🪽",
  "In {year}, may you feel proud of yourself more often, {name}. 🌈",
  "{year}년에도 {name}님이 원하는 길로 쭉 나아가길 🚀",
  "Năm {year} chúc {name} đi đâu cũng gặp điều lành, về đâu cũng thấy yên 🏡✨",
  "May {year} be kind to you, {name}. 🤍",
  "{name}님, {year}년엔 마음이 늘 편안하길 🌿",
  "Chúc {name} năm {year} rực rỡ theo cách của riêng mình 🌟",
  "Wishing {name} a {year} filled with love, laughter, and peace. 🕊️",
  "Năm {year} chúc {name} may mắn tới tấp, niềm vui ngập tràn 🎉"
];

// ===== People + session =====
let PEOPLE = [];
let selectedPerson = null;
let lastWishIndex = -1;
let session = { loggedIn:false, viewer:null, target:null };
const firstWishShown = new Set();

function setStatus(msg, bad=false){
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.toggle('bad', !!bad);
}

async function ensureServices(){
  if (!window.AppServices){
    throw new Error('AppServices chưa sẵn sàng (services.js chưa load hoặc lỗi).');
  }
  await window.AppServices.initFirebaseIfNeeded?.();
}

function isOwnerRole(){
  return !!(session.loggedIn && session.viewer && session.viewer.role === 'owner');
}

// ===== Special: AQ vẫn được quay rút thưởng =====
function isAQ(person){
  const k = removeDiacritics(person?.key || '');
  const l = removeDiacritics(person?.label || '');
  if (k === 'ethereal' || k === 'aq') return true;
  if (l === 'aq') return true;
  if (l.includes('anh quynh')) return true;
  return false;
}

function isHongNhung(person){
  const l = removeDiacritics(person?.label || '');
  return l.includes('hong nhung');
}

function canRepeatMiniGame(person){
  return isOwnerRole() || isAQ(person);
}

// ===== Unlock keys =====
function playKey(){ return String(session?.viewer?.key || ''); }
function keyUnlocked(k){ return 'hpny2026_unlocked_' + k; }
function isUnlocked(k){ return localStorage.getItem(keyUnlocked(k)) === '1'; }

function refreshGameLockUI(){
  const k = playKey();
  const owner = isOwnerRole();
  const unlocked = owner || (k && isUnlocked(k));

  // ✅ bỏ giới hạn chơi 1 lần => chỉ cần unlocked là chơi được
  const canOpen = !!unlocked;

  if (btnOpenLuck){
    btnOpenLuck.disabled = !canOpen;
    btnOpenLuck.classList.toggle('disabled', !canOpen);
  }

  if (gameLockHintTop){
    const show = session.loggedIn && !owner && k && !isUnlocked(k);
    gameLockHintTop.style.display = show ? '' : 'none';
  }

  // Ẩn nút owner replay (giờ không cần)
  btnOwnerReplay?.classList.add('hidden');
}

function setUnlockedForCurrentViewer(){
  const k = playKey();
  if (!k) return;
  localStorage.setItem(keyUnlocked(k), '1');
  refreshGameLockUI();
}

// ===== Owner auth UI =====
function isOwnerAuthed(){
  try{ return window.AppServices?.isOwnerAuthed?.() === true; }
  catch{ return false; }
}

function updateOwnerUI(){
  const ownerRole = isOwnerRole();
  const authed = isOwnerAuthed();

  btnOwnerLogin?.classList.toggle('hidden', !ownerRole || authed);
  btnOwnerLogout?.classList.toggle('hidden', !ownerRole || !authed);
  btnOwnerDashboard?.classList.toggle('hidden', !ownerRole || !authed);

  btnOwnerReplay?.classList.add('hidden'); // ✅ luôn ẩn

  refreshGameLockUI();
}

function openOwnerModal(){
  ownerModal?.classList.remove('hidden');
  renderOwnerTab();
}
function closeOwnerModal(){
  ownerModal?.classList.add('hidden');
}

function formatDuration(sec){
  sec = Math.max(0, Number(sec||0));
  const m = Math.floor(sec/60);
  const s = sec%60;
  if (m <= 0) return s + 's';
  return m + 'm ' + s + 's';
}

function fmtTime(ts){
  try{
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString('vi-VN');
    if (ts.seconds) return new Date(ts.seconds*1000).toLocaleString('vi-VN');
    return new Date(ts).toLocaleString('vi-VN');
  }catch{ return ''; }
}

async function renderOwnerTab(){
  if (!ownerBody) return;
  ownerBody.textContent = 'Đang tải...';

  try{
    await ensureServices();
  }catch(e){
    ownerBody.innerHTML = `
      <div class="ownerRow">
        <div><b>⚠️ ${escapeHtml(e.message || 'Lỗi services')}</b></div>
        <div class="ownerMeta">Mở DevTools → Console/Network để xem services.js có lỗi/404 không.</div>
      </div>`;
    return;
  }

  if (!isOwnerAuthed()){
    ownerBody.innerHTML = `
      <div class="ownerRow">
        <div><b>🔐 Bạn chưa đăng nhập Google Owner</b></div>
        <div class="ownerMeta">Bấm “Owner Login” ở góc trên để đăng nhập.</div>
      </div>`;
    return;
  }

  try{
    if (ownerTab === 'views'){
      const list = await window.AppServices.getLatestViews(200);
      const ownerKey = window.OWNER_KEY || '';
      const filtered = list.filter(v => (v.ownerKey||'') === ownerKey);
      if (!filtered.length){ ownerBody.textContent = 'Chưa có lượt xem nào.'; return; }

      ownerBody.innerHTML = filtered.map(v => `
        <div class="ownerRow">
          <div class="ownerMeta">
            <span class="pillMini">👀 ${escapeHtml(v.viewerLabel || v.viewerKey || 'Ẩn danh')}</span>
            xem thiệp: <b>${escapeHtml(v.targetLabel || v.targetKey || '')}</b>
            • thời lượng: <b>${formatDuration(v.durationSec || 0)}</b>
          </div>
          <div class="ownerMeta">
            Bắt đầu: ${escapeHtml(fmtTime(v.startedAt))}
            • Kết thúc: ${escapeHtml(fmtTime(v.endedAt))}
          </div>
          <div class="ownerMeta">UA: ${escapeHtml(String(v.userAgent||'').slice(0,120))}</div>
          <div class="row" style="justify-content:flex-end">
            <button class="btnSecondary" type="button" data-del-view="${escapeHtml(v.id)}">🗑 Xoá</button>
          </div>
        </div>`).join('');
    }else{
      const [wishList, fortuneList] = await Promise.all([
        window.AppServices.getLatestWishes(200),
        window.AppServices.getLatestFortunes ? window.AppServices.getLatestFortunes(200) : Promise.resolve([])
      ]);

      const ownerKey = window.OWNER_KEY || '';
      const wishes = wishList.filter(w => (w.ownerKey||'') === ownerKey);
      const fortunes = (fortuneList || []).filter(f => (f.ownerKey||'') === ownerKey);

      if (!wishes.length && !fortunes.length){ ownerBody.textContent = 'Chưa có lời chúc / bóc quẻ nào.'; return; }

      const fortuneHtml = fortunes.length ? `
        <div class="ownerRow" style="background:rgba(180,0,24,.05)">
          <div class="ownerMeta"><span class="pillMini">🧧 Bóc quẻ (lộc tiền)</span> • tổng: <b>${fortunes.length}</b></div>
          ${fortunes.map(f => `
            <div style="padding:10px 0;border-top:1px dashed rgba(180,0,24,.18)">
              <div class="ownerMeta">
                <span class="pillMini">🧑 ${escapeHtml(f.viewerLabel || f.viewerKey || 'Ẩn danh')}</span>
                trúng: <b>${escapeHtml(formatMoneyVND(f.amount || 0))}</b>
                • ${escapeHtml(fmtTime(f.createdAt))}
              </div>
              ${(f.bankName || f.bankAccount) ? `
                <div class="ownerMeta">🏦 ${escapeHtml(f.bankName || '')} • ${escapeHtml(f.bankAccount || '')}</div>
              ` : ``}
              <div class="row" style="justify-content:flex-end">
                <button class="btnSecondary" type="button" data-del-fortune="${escapeHtml(f.id)}">🗑 Xoá</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '';

      const wishesHtml = wishes.length ? wishes.map(w => `
        <div class="ownerRow">
          <div class="ownerMeta">
            <span class="pillMini">💌 ${escapeHtml(w.viewerLabel || w.viewerKey || 'Ẩn danh')}</span>
            gửi khi đang xem thiệp: <b>${escapeHtml(w.targetLabel || w.targetKey || '')}</b>
            • ${escapeHtml(fmtTime(w.createdAt))}
          </div>
          <div style="white-space:pre-wrap">${escapeHtml(w.message || '')}</div>
          <div class="row" style="justify-content:flex-end">
            <button class="btnSecondary" type="button" data-del-wish="${escapeHtml(w.id)}">🗑 Xoá</button>
          </div>
        </div>`).join('') : '<div class="ownerRow">Chưa có lời chúc.</div>';

      ownerBody.innerHTML = fortuneHtml + wishesHtml;
    }
  }catch(e){
    console.warn(e);
    ownerBody.innerHTML = `
      <div class="ownerRow">
        <div><b>⚠️ Không tải được dữ liệu</b></div>
        <div class="ownerMeta">Kiểm tra Firestore Rules (read/delete owner-only) hoặc Owner chưa login.</div>
      </div>`;
  }
}

ownerBody?.addEventListener('click', async (e) => {
  const bView = e.target.closest('[data-del-view]');
  const bWish = e.target.closest('[data-del-wish]');
  const bFortune = e.target.closest('[data-del-fortune]');
  if (!bView && !bWish && !bFortune) return;

  if (!isOwnerAuthed()){
    alert('Bạn chưa Owner Login.');
    return;
  }

  const ok = confirm('Xoá dữ liệu này? Không khôi phục được.');
  if (!ok) return;

  try{
    await ensureServices();
    if (bView){
      const id = bView.getAttribute('data-del-view');
      await window.AppServices.deleteView(id);
    }else if (bWish){
      const id = bWish.getAttribute('data-del-wish');
      await window.AppServices.deleteWish(id);
    }else{
      const id = bFortune.getAttribute('data-del-fortune');
      await window.AppServices.deleteFortune(id);
    }
    await renderOwnerTab();
  }catch(err){
    console.warn(err);
    alert('Xoá thất bại. Kiểm tra Firestore Rules / Owner Login.');
  }
});

// ===== Wish helpers =====
function randomWish(pool){
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (pool.length > 1 && idx === lastWishIndex);
  lastWishIndex = idx;
  return pool[idx];
}

function getDisplayNameForTarget(t){
  if (!t) return 'bạn';
  const override = (t.nameOverride || '').trim();
  return override || t.label || 'bạn';
}

function formatWish(template, displayName){
  const name = (displayName || 'bạn').trim();
  const year = (yearInput.value || yearText.textContent || defaultYear).trim();
  return String(template).replaceAll('{name}', name).replaceAll('{year}', year);
}

function buildWishText(template, target){
  const name = getDisplayNameForTarget(target);
  let text = formatWish(template, name);
  const suffix = (target?.suffix || '').trim();
  if (suffix) text += ' ' + suffix;
  return text;
}

function getWishPoolForTarget(target){
  if (!target) return GLOBAL_WISHES;
  if (target.useGlobalRandomOnly) return GLOBAL_WISHES;
  if (Array.isArray(target.wishes) && target.wishes.length) return target.wishes;
  return GLOBAL_WISHES;
}

function showRandomWish(){
  if (!session.loggedIn || !session.target) return;
  const pool = getWishPoolForTarget(session.target);
  const t = randomWish(pool);
  wishEl.textContent = buildWishText(t, session.target);
  burst(lastPointer.x || (window.innerWidth*0.5), lastPointer.y || (window.innerHeight*0.35), 110);
}

function showInitialWishIfAny(target){
  if (!target?.firstWish) return false;
  if (firstWishShown.has(target.key)) return false;
  firstWishShown.add(target.key);
  wishEl.textContent = buildWishText(target.firstWish, target);
  return true;
}

// ===== Avatar =====
const DEFAULT_AVATAR = './avatars/default.pnj.jpg';

function tryLoadAvatarFromCandidates(candidates){
  if (!avatarImg) return;
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length){ avatarImg.src = DEFAULT_AVATAR; return; }
    avatarImg.onerror = tryNext;
    avatarImg.src = candidates[i++];
  };
  tryNext();
}

function setAvatar(person){
  if (!avatarImg) return;
  if (!person){ avatarImg.src = DEFAULT_AVATAR; return; }
  const exts = person.exts || ['jpg','png','webp','jpeg'];
  const candidates = exts.map(ext => `./avatars/${person.key}.${ext}`);
  tryLoadAvatarFromCandidates(candidates);
}

// ===== Load people =====
async function loadPeople(){
  const res = await fetch('./avatars/people.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Cannot load avatars/people.json');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('people.json must be an array');

  PEOPLE = data.map(p => ({
    key: String(p.key || '').trim(),
    label: String(p.label || '').trim(),
    pass: String(p.pass || '').trim(),
    role: String(p.role || 'guest').trim(),
    exts: Array.isArray(p.exts) ? p.exts : ['jpg','png','webp','jpeg'],
    wishes: Array.isArray(p.wishes) ? p.wishes : null,
    firstWish: p.firstWish ? String(p.firstWish) : '',
    useGlobalRandomOnly: !!p.useGlobalRandomOnly,
    suffix: p.suffix ? String(p.suffix) : '',
    nameOverride: p.nameOverride ? String(p.nameOverride) : ''
  })).filter(p => p.key && p.label && p.pass);
}

function openMenu(){
  if (!menu) return;
  menu.classList.remove('hidden');
  if (search) search.value = '';
  renderMenu('');
  setTimeout(() => search?.focus(), 0);
}

function closeMenu(){ menu?.classList.add('hidden'); }

function renderMenu(q){
  const query = (q || '').trim().toLowerCase();
  const list = PEOPLE.filter(p =>
    p.label.toLowerCase().includes(query) || p.key.toLowerCase().includes(query)
  );

  if (!menuList) return;

  menuList.innerHTML = list.map(p => `
    <div class="item" data-key="${escapeHtml(p.key)}">
      <div class="left">
        <div class="name">${escapeHtml(p.label)}</div>
        <div class="meta">@${escapeHtml(p.key)}</div>
      </div>
      <div class="tag">${p.role === 'owner' ? 'OWNER' : 'GUEST'}</div>
    </div>`).join('') || `
    <div class="item">
      <div class="left">
        <div class="name">Không tìm thấy</div>
        <div class="meta">Thử gõ tên hoặc key</div>
      </div>
    </div>`;
}

function pickPersonByKey(key){
  const p = PEOPLE.find(x => x.key === key);
  if (!p) return;

  selectedPerson = p;

  if (selectText){
    selectText.innerHTML = `<span>${escapeHtml(p.label)} <small>(@${escapeHtml(p.key)})</small></span>`;
  }

  closeMenu();
  btnOwnerView.disabled = !(session.loggedIn && session.viewer && session.viewer.role === 'owner');
  updateOwnerUI();
}

selectBtn?.addEventListener('click', () => {
  if (!menu) return;
  if (menu.classList.contains('hidden')) openMenu();
  else closeMenu();
});
search?.addEventListener('input', () => renderMenu(search.value));
menuList?.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const key = item.getAttribute('data-key');
  if (key) pickPersonByKey(key);
});
document.addEventListener('click', (e) => {
  if (!selectWrap || !menu) return;
  if (!selectWrap.contains(e.target)) closeMenu();
});

// ===== Lock card / session UI =====
function lockCard(msg){
  session = { loggedIn:false, viewer:null, target:null };
  firstWishShown.clear();

  hideFlow();

  try{ music?.pause(); }catch{}
  musicOn = false;
  setMusicButton(false);

  try{ window.AppServices?.stopView?.(); }catch{}

  lock?.classList.remove('hidden');

  if (chip) chip.textContent = 'Chưa mở';
  if (badge) badge.textContent = '🐴 Thiệp Năm Mới • Năm Ngọ 2026 🐎';
  if (subLine) subLine.textContent = 'Mở khóa xong bạn sẽ thấy lời chúc dành riêng cho bạn 🎁';

  if (viewerName){
    viewerName.value = '';
    viewerName.disabled = true;
  }
  btnWish && (btnWish.disabled = true);

  if (btnSendWish) btnSendWish.disabled = true;
  if (wishMsg){
    wishMsg.value = '';
    wishMsg.disabled = true;
  }

  updateOwnerUI();

  if (wishEl) wishEl.textContent = '🔒 Thiệp đang khóa. Hãy mở thiệp để xem lời chúc.';
  setAvatar(null);

  if (btnOwnerView) btnOwnerView.disabled = true;
  btnLogout?.classList.add('hidden');

  refreshGameLockUI();
  setStatus(msg || '👉 Chọn người + nhập mật khẩu để bắt đầu.', false);
}

function applySessionUI(){
  const v = session.viewer;
  const t = session.target;

  if (chip) chip.textContent = v.role === 'owner' ? 'Đã mở • Owner' : 'Đã mở';
  if (badge) badge.textContent = v.role === 'owner' ? '👑 Owner Mode • Tết 2026' : '🐴 Thiệp Năm Mới • Năm Ngọ 2026 🐎';

  if (viewerName){
    viewerName.value = t.label;
    viewerName.disabled = true;
  }

  if (btnWish) btnWish.disabled = false;
  if (btnOwnerView) btnOwnerView.disabled = !(v.role === 'owner' && selectedPerson);

  btnLogout?.classList.remove('hidden');

  if (subLine){
    subLine.textContent = (v.role === 'owner')
      ? '👑 Owner: có thể xem thiệp người khác (không cần mật khẩu của họ).'
      : 'Chúc bạn một năm mới rực rỡ và thật bình an 🌸';
  }

  setAvatar(t);

  const didShowFirst = showInitialWishIfAny(t);
  if (!didShowFirst){
    const pool = getWishPoolForTarget(t);
    const template = randomWish(pool);
    wishEl.textContent = buildWishText(template, t);
  }

  lock?.classList.add('hidden');

  if (btnSendWish) btnSendWish.disabled = false;
  if (wishMsg) wishMsg.disabled = false;

  try{ window.AppServices?.startView?.(session.viewer, session.target); }catch{}
  updateOwnerUI();

  burst(window.innerWidth * 0.5, window.innerHeight * 0.28, 180);
  refreshGameLockUI();
}

btnUnlock?.addEventListener('click', () => {
  if (!selectedPerson){ setStatus('❌ Bạn chưa chọn người.', true); return; }
  const pw = (pass?.value || '').trim();
  if (!pw){ setStatus('⚠️ Bạn chưa nhập mật khẩu.', true); return; }

  if (pw !== selectedPerson.pass){
    setAvatar(selectedPerson);
    setStatus('❌ Sai mật khẩu. Thử lại nha!', true);
    return;
  }

  session.loggedIn = true;
  session.viewer = selectedPerson;
  session.target = selectedPerson;

  setStatus('✅ Mở thiệp thành công! 🎉', false);
  applySessionUI();
});

btnOwnerView?.addEventListener('click', () => {
  if (!session.loggedIn || !session.viewer || session.viewer.role !== 'owner'){
    setStatus('❌ Chỉ Owner mới dùng được.', true);
    return;
  }
  if (!selectedPerson){ setStatus('⚠️ Chọn người cần xem trước đã.', true); return; }
  session.target = selectedPerson;
  applySessionUI();
});

btnLogout?.addEventListener('click', () => lockCard('👋 Đã đăng xuất.'));
btnHint?.addEventListener('click', () => {
  if (!selectedPerson) return alert('Bạn hãy chọn người trước đã.');
  alert(`🔑 Mật khẩu của ${selectedPerson.label} (@${selectedPerson.key}) là: ${selectedPerson.pass}`);
});
btnWish?.addEventListener('click', showRandomWish);

// ===== Owner Login/Logout/Dashboard =====
btnOwnerLogin?.addEventListener('click', async () => {
  try{
    await ensureServices();
    const info = await window.AppServices.ownerGoogleLogin();
    alert('✅ Owner Google Login OK\nUID: ' + (info.uid || '') + '\nEmail: ' + (info.email || ''));
  }catch(e){
    console.warn(e);
    alert('❌ Owner login lỗi.\nMsg: ' + (e.message || e) +
      "\n\nNếu là unauthorized-domain: Firebase Console → Auth → Settings → Authorized domains → Add domain bạn đang chạy.");
  }finally{
    updateOwnerUI();
  }
});

btnOwnerLogout?.addEventListener('click', async () => {
  try{ await window.AppServices.ownerGoogleLogout(); }catch{}
  updateOwnerUI();
});

btnOwnerDashboard?.addEventListener('click', openOwnerModal);
btnCloseOwner?.addEventListener('click', closeOwnerModal);
ownerModal?.addEventListener('click', (e) => { if (e.target === ownerModal) closeOwnerModal(); });

btnTabViews?.addEventListener('click', () => { ownerTab = 'views'; renderOwnerTab(); });
btnTabWishes?.addEventListener('click', () => { ownerTab = 'wishes'; renderOwnerTab(); });
btnRefreshOwner?.addEventListener('click', () => renderOwnerTab());

// ===== Success overlay =====
function showSuccessPage(){
  successPage?.classList.remove('hidden');
  burst(window.innerWidth * 0.5, window.innerHeight * 0.28, 160);
}
function hideSuccessPage(){ successPage?.classList.add('hidden'); }
btnSuccessClose?.addEventListener('click', hideSuccessPage);
successPage?.addEventListener('click', (e) => { if (e.target === successPage) hideSuccessPage(); });

// ===== Wish send =====
// ✅ NÚT GỬI LỜI CHÚC: chỉ LƯU + unlock, KHÔNG gửi email
let PENDING_WISH_MESSAGE = ""; // lưu lời chúc để gửi mail ở cuối

btnSendWish?.addEventListener('click', async () => {
  const message = (wishMsg?.value || '').trim();
  if (!message){
    setStatus('⚠️ Bạn chưa nhập lời chúc.', true);
    return;
  }

  try{
    btnSendWish.disabled = true;
    await ensureServices();

    // ✅ lưu lại để lát gửi mail kèm nhận lộc
    PENDING_WISH_MESSAGE = message;

    const result = await window.AppServices.sendWish({
      viewerKey: session.viewer?.key || '',
      viewerLabel: session.viewer?.label || '',
      targetKey: session.target?.key || '',
      targetLabel: session.target?.label || '',
      message,
      sendEmail: false // ✅ KHÔNG gửi Gmail ở bước này
    });

    if (result && result.savedToFirestore){
      if (wishMsg) wishMsg.value = '';

      setUnlockedForCurrentViewer();
      showSuccessPage();

      setStatus('✅ Đã lưu lời chúc! “Nhận lộc” đã được mở khóa 🎁', false);
    }else{
      setStatus('⚠️ Lưu lời chúc chưa thành công (Firestore fail).', true);
      alert('⚠️ Lưu lời chúc chưa thành công.\nHãy kiểm tra Firestore Rules.');
    }
  }catch(e){
    console.warn(e);
    setStatus('❌ Không lưu được lời chúc. Kiểm tra cấu hình Firestore.', true);
    alert('❌ Không lưu được lời chúc.\n' + (e.message || e));
  }finally{
    btnSendWish.disabled = false;
  }
});

// ===== Mini game flow =====
const flow = $('flow');
const stageIntro = $('stageIntro');
const stageBank = $('stageBank');
const stageWheel = $('stageWheel');
const stageFortune = $('stageFortune');

const btnIntroStart = $('btnIntroStart');
const btnBankConfirm = $('btnBankConfirm');
const btnBankBack = $('btnBankBack');
const btnWheelBack = $('btnWheelBack');
const btnSpin = $('btnSpin');
const btnWheelNext = $('btnWheelNext');
const btnFortuneBack = $('btnFortuneBack');
const btnShake = $('btnShake');
const btnFinish = $('btnFinish');

const bankName = $('bankName');
const bankAccount = $('bankAccount');
const bankNote = $('bankNote');

const wheelEl = $('wheel');
const wheelResultEl = $('wheelResult');

const envelope = $('envelope');
const fortuneMoney = $('fortuneMoney');
const fortuneMsg = $('fortuneMsg');
const fortuneMeta = $('fortuneMeta');

const BANK_STORAGE_PREFIX = 'hpny2026_bank_';

const WHEEL_SEGMENTS = [
  { id: 'try', label: 'Chúc may mắn', prize: false },
  { id: 'ring', label: 'Nhẫn Pandora', prize: true },
  { id: 'try', label: 'Chúc may mắn', prize: false },
  { id: 'try', label: 'Chúc may mắn', prize: false },
  { id: 'bracelet', label: 'Vòng tay Pandora', prize: true },
  { id: 'try', label: 'Chúc may mắn', prize: false },
  { id: 'try', label: 'Chúc may mắn', prize: false },
  { id: 'try', label: 'Chúc may mắn', prize: false },
];
const WHEEL_N = WHEEL_SEGMENTS.length;
const WHEEL_ANGLE = 360 / WHEEL_N;

let flowState = {
  active: false,
  person: null,
  bankConfirmed: false,
  wheelSpins: 0,
  wheelOutcome: null,
  fortuneDone: false,
};

function showFlow(){
  if (!flow) return;
  flow.classList.remove('hidden');
  flowState.active = true;
}
function hideFlow(){
  if (!flow) return;
  flow.classList.add('hidden');
  flowState.active = false;
}

function showStage(stageEl){
  [stageIntro, stageBank, stageWheel, stageFortune].forEach(s => s?.classList.add('hidden'));
  stageEl?.classList.remove('hidden');
}

function loadBankInfoFor(person){
  try{
    const raw = localStorage.getItem(BANK_STORAGE_PREFIX + (person?.key || ''));
    if (!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
function saveBankInfoFor(person, payload){
  try{
    localStorage.setItem(BANK_STORAGE_PREFIX + (person?.key || ''), JSON.stringify(payload));
  }catch{}
}

function buildWheelUI(){
  if (!wheelEl) return;
  wheelEl.innerHTML = '';
  for (let i = 0; i < WHEEL_N; i++){
    const seg = document.createElement('div');
    seg.className = 'wheelSeg' + (i % 2 === 1 ? ' isGold' : '');
    const midAngle = i * WHEEL_ANGLE;
    seg.style.setProperty('--rot', `${midAngle}deg`);
    seg.style.setProperty('--neg', `${-midAngle}deg`);
    seg.innerHTML = `<span>${escapeHtml(WHEEL_SEGMENTS[i].label)}</span>`;
    wheelEl.appendChild(seg);
  }
}

function resetWheelUI(){
  if (!wheelEl) return;
  wheelEl.style.transition = 'none';
  wheelEl.style.transform = 'rotate(0deg)';
  void wheelEl.offsetWidth;
  wheelEl.style.transition = 'transform 4.2s cubic-bezier(.17,.67,.12,1)';

  if (wheelResultEl){
    wheelResultEl.classList.add('hidden');
    wheelResultEl.textContent = '';
  }
  btnWheelNext?.classList.add('hidden');
  if (btnSpin) btnSpin.disabled = false;
}

function wheelResultText(outcome){
  if (outcome === 'ring') return '🎉 Chúc mừng! Bạn đã quay trúng: NHẪN PANDORA 💍';
  if (outcome === 'bracelet') return '🎉 Chúc mừng! Bạn đã quay trúng: VÒNG TAY PANDORA ✨';
  return '😄 Chưa trúng giải lớn lần này.\n\nĐừng lo, mình còn có “lắc quẻ may mắn” để nhận lộc đầu năm 🧧';
}

function pickSegmentIndexForOutcome(outcome){
  const idxs = [];
  for (let i=0; i<WHEEL_N; i++){
    if (outcome === 'none' && WHEEL_SEGMENTS[i].id === 'try') idxs.push(i);
    if (outcome !== 'none' && WHEEL_SEGMENTS[i].id === outcome) idxs.push(i);
  }
  return idxs.length ? idxs[(Math.random() * idxs.length) | 0] : 0;
}

function spinWheelToIndex(idx){
  if (!wheelEl) return Promise.resolve();

  return new Promise((resolve) => {
    const baseTurns = 6 + ((Math.random() * 3) | 0);
    const jitter = (Math.random() * (WHEEL_ANGLE * 0.6)) - (WHEEL_ANGLE * 0.3);
    const target = (360 - (idx * WHEEL_ANGLE)) % 360;
    const finalDeg = baseTurns * 360 + target + jitter;

    const onEnd = () => resolve();
    wheelEl.addEventListener('transitionend', onEnd, { once: true });
    wheelEl.style.transform = `rotate(${finalDeg}deg)`;
  });
}

function getWheelOutcomeFor(person){
  // - Chỉ Hồng Nhung trúng NHẪN
  // - Không ai trúng VÒNG TAY
  if (isHongNhung(person)) return 'ring';
  return 'none';
}

// ===== Fortune =====
const FORTUNE_MESSAGES = {
  50000: [
    '{name} ơi, lộc nhỏ nhưng vui to – năm {year} cười nhiều hơn lo! 😊',
    '{year} chúc {name} gặp đúng người, đúng việc, đúng thời điểm 🎯',
    'Lộc nhỏ đầu năm: chúc {name} {year} nhẹ nhàng mà rực rỡ 🌟',
  ],
  200000: [
    '{name} nhận lộc 200k – chúc {year} tiền vào như nước, niềm vui ngập tràn 🎉💰',
    'Lộc 200k gửi {name}: chúc {year} mọi điều như ý, an yên và đủ đầy 🤍',
  ],
  500000: [
    '{name} nhận lộc 500k – chúc năm {year} bùng nổ tài lộc, làm đâu thắng đó 💥💰',
    'Lộc 500k gửi {name}: chúc {year} phát tài phát lộc, mọi việc hanh thông 🎉',
  ]
};

function getFortuneAmountFor(person){
  const l = removeDiacritics(person?.label || '');
  const k = removeDiacritics(person?.key || '');

  if (k === 'ethereal' || k === 'aq' || l === 'aq' || l.includes('anh quynh')) return 500000;
  if (l.includes('gia truong')) return 200000;
  return 50000;
}

function formatWishTokens(template, person){
  const name = (person?.label || person?.key || 'bạn').trim();
  const year = (yearInput?.value || yearText?.textContent || String(new Date().getFullYear())).trim();
  return String(template).replaceAll('{name}', name).replaceAll('{year}', year);
}

function getFortuneFor(person){
  const amount = getFortuneAmountFor(person);
  const pool = FORTUNE_MESSAGES[amount] || FORTUNE_MESSAGES[50000];
  const seed = `${person?.key || person?.label || ''}|${amount}`;
  const idx = hashStringFNV1a(seed) % pool.length;
  const msg = formatWishTokens(pool[idx], person);
  return { amount, msg };
}

function resetFortuneUI(){
  flowState.fortuneDone = false;
  if (fortuneMoney) fortuneMoney.textContent = '—';
  if (fortuneMsg) fortuneMsg.textContent = 'Bấm “Lắc quẻ” để nhận lời chúc.';
  if (fortuneMeta) fortuneMeta.textContent = '';
  btnFinish?.classList.add('hidden');
}

function startFlowFor(person){
  flowState = {
    active: true,
    person,
    bankConfirmed: false,
    wheelSpins: 0,
    wheelOutcome: null,
    fortuneDone: false,
  };

  const bank = loadBankInfoFor(person);
  if (bankName) bankName.value = bank?.bankName || '';
  if (bankAccount) bankAccount.value = bank?.bankAccount || '';

  resetWheelUI();
  resetFortuneUI();

  showFlow();
  showStage(stageIntro);
  burst(window.innerWidth * 0.5, window.innerHeight * 0.25, 120);
}

async function handleSpin(){
  if (!btnSpin || btnSpin.disabled) return;

  resetWheelUI();
  btnSpin.disabled = true;

  const person = flowState.person;
  const outcome = getWheelOutcomeFor(person);
  const idx = pickSegmentIndexForOutcome(outcome);

  await spinWheelToIndex(idx);

  flowState.wheelOutcome = outcome;
  flowState.wheelSpins += 1;

  if (wheelResultEl){
    wheelResultEl.textContent = wheelResultText(outcome);
    wheelResultEl.classList.remove('hidden');
  }

  btnWheelNext?.classList.remove('hidden');

  // AQ/Owner có thể quay tiếp nếu muốn
  if (canRepeatMiniGame(session.viewer)){
    btnSpin.disabled = false;
  }

  burst(window.innerWidth * 0.5, window.innerHeight * 0.28, 140);
}

btnIntroStart?.addEventListener('click', () => {
  showStage(stageBank);
  bankNote && (bankNote.textContent = 'Sau khi xác nhận bạn sẽ được chơi vòng quay may mắn 🎡');
});
btnBankBack?.addEventListener('click', () => showStage(stageIntro));

btnBankConfirm?.addEventListener('click', () => {
  const bn = (bankName?.value || '').trim();
  const ba = (bankAccount?.value || '').trim();

  if (!bn || !ba){
    bankNote && (bankNote.textContent = '⚠️ Bạn nhập giúp mình Tên ngân hàng + Số tài khoản nha.');
    burst(window.innerWidth*0.5, window.innerHeight*0.28, 90);
    return;
  }

  saveBankInfoFor(flowState.person, { bankName: bn, bankAccount: ba });
  flowState.bankConfirmed = true;

  resetWheelUI();
  showStage(stageWheel);
  burst(window.innerWidth*0.5, window.innerHeight*0.25, 120);
});

btnWheelBack?.addEventListener('click', () => showStage(stageBank));
btnSpin?.addEventListener('click', () => { handleSpin().catch(console.warn); });

btnWheelNext?.addEventListener('click', () => {
  showStage(stageFortune);
  resetFortuneUI();
  burst(window.innerWidth*0.5, window.innerHeight*0.22, 100);
});

btnFortuneBack?.addEventListener('click', () => showStage(stageWheel));

// giữ kết quả fortune để email ở cuối
let LAST_FORTUNE = { amount: 0, bankName: "", bankAccount: "" };

btnShake?.addEventListener('click', async () => {
  if (flowState.fortuneDone) return;
  const person = flowState.person;

  envelope?.classList.remove('shake');
  void envelope?.offsetWidth;
  envelope?.classList.add('shake');

  const f = getFortuneFor(person);
  if (fortuneMoney) fortuneMoney.textContent = formatMoneyVND(f.amount);
  if (fortuneMsg) fortuneMsg.textContent = f.msg;

  const bn = (bankName?.value || '').trim();
  const ba = (bankAccount?.value || '').trim();

  LAST_FORTUNE = { amount: f.amount, bankName: bn, bankAccount: ba };

  if (fortuneMeta){
    fortuneMeta.textContent = (bn && ba)
      ? `📩 Đã ghi nhớ: ${bn} • ${ba} • ${new Date().toLocaleString('vi-VN')}`
      : `${new Date().toLocaleString('vi-VN')}`;
  }

  flowState.fortuneDone = true;
  btnFinish?.classList.remove('hidden');

  // lưu lịch sử bóc quẻ để owner xem
  try{
    await ensureServices();
    await window.AppServices?.recordFortune?.({
      viewerKey: person?.key || '',
      viewerLabel: person?.label || person?.key || '',
      amount: f.amount,
      bankName: bn,
      bankAccount: ba
    });
  }catch(err){
    console.warn('recordFortune failed', err);
  }

  burst(window.innerWidth*0.5, window.innerHeight*0.26, 160);
});

// ✅ NÚT CUỐI: “Nhận thiệp” -> lúc này mới gửi Gmail kèm thông tin nhận lộc + lời chúc
btnFinish?.addEventListener('click', async () => {
  try{
    // chỉ gửi mail nếu có lời chúc đã lưu trước đó
    const msg = (PENDING_WISH_MESSAGE || "").trim();
    if (msg){
      await ensureServices();
      await window.AppServices.sendWish({
        viewerKey: session.viewer?.key || '',
        viewerLabel: session.viewer?.label || '',
        targetKey: session.target?.key || '',
        targetLabel: session.target?.label || '',
        message: msg,
        fortuneAmount: LAST_FORTUNE.amount || 0,
        bankName: LAST_FORTUNE.bankName || "",
        bankAccount: LAST_FORTUNE.bankAccount || "",
        sendEmail: true // ✅ chỉ gửi ở đây
      });
      // tránh bấm lại spam mail
      PENDING_WISH_MESSAGE = "";
    }
  }catch(e){
    console.warn("send final email failed:", e);
  }

  hideFlow();
  setStatus('🎉 Chúc bạn năm mới vui vẻ! Nếu muốn nghe nhạc thì bấm Play ở góc trên nha 🎶', false);
  burst(window.innerWidth*0.5, window.innerHeight*0.2, 160);
});

// ===== Open luck flow (after unlock) =====
async function openLuckFlow(){
  if (!session.loggedIn){
    alert('Bạn cần mở thiệp trước đã 😊');
    return false;
  }

  const k = playKey();
  const owner = isOwnerRole();

  if (!owner && !isUnlocked(k)){
    alert('Bạn hãy Gửi lời chúc cho chủ sở hữu trước để mở khóa Nhận lộc nhé 💌');
    return false;
  }

  // ✅ bỏ giới hạn 1 lần: ai cũng chơi lại vô hạn
  startFlowFor(session.target);
  return true;
}

btnOpenLuck?.addEventListener('click', openLuckFlow);
btnSuccessLuck?.addEventListener('click', () => {
  hideSuccessPage();
  openLuckFlow();
});

// ===== Auto fireworks toggle =====
const autoToggle = $('auto');
autoToggle?.addEventListener('change', () => { autoFire = !!autoToggle.checked; });
if (autoToggle) autoFire = !!autoToggle.checked;

// ===== Init =====
async function init(){
  resizeFx();
  initCountdown();
  initPetals();

  if (ctx){
    ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
    requestAnimationFrame(stepFx);
  }

  buildWheelUI();
  await loadPlaylist();

  try{
    await loadPeople();
    renderMenu('');
  }catch(e){
    console.warn(e);
    setStatus('❌ Lỗi tải danh sách người (people.json).', true);
  }

  lockCard();
  updateOwnerUI();
  refreshGameLockUI();
}

init().catch((e) => {
  console.warn(e);
  setStatus('❌ Lỗi khởi tạo app.js', true);
});
