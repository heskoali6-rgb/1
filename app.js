const state = { channels: [], view: 'all', group: null, search: '', favorites: new Set(JSON.parse(localStorage.getItem('fixab-favorites') || '[]')) };
const $ = (selector) => document.querySelector(selector);
let hls;

function decode(text) { try { return decodeURIComponent(text); } catch { return text; } }
function attribute(line, name) { return (line.match(new RegExp(`${name}="([^"]*)"`)) || [])[1] || ''; }
function parsePlaylist(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const channels = [];
  for (let i = 0; i < lines.length; i++) {
    const info = lines[i].trim();
    if (!info.startsWith('#EXTINF:')) continue;
    let url = '';
    while (++i < lines.length) { const candidate = lines[i].trim(); if (candidate && !candidate.startsWith('#')) { url = candidate; break; } }
    if (!url) continue;
    const title = (info.split(',').slice(1).join(',').trim() || 'قناة بدون اسم');
    channels.push({ id: `${title}|${url}`, name: decode(title), url, logo: attribute(info,'tvg-logo'), group: decode(attribute(info,'group-title') || 'أخرى') });
  }
  return channels;
}
function visibleChannels() {
  const query = state.search.toLocaleLowerCase();
  return state.channels.filter(c => (!state.group || c.group === state.group) && (state.view !== 'favorites' || state.favorites.has(c.id)) && (!query || `${c.name} ${c.group}`.toLocaleLowerCase().includes(query)));
}
function escapeHtml(value) { const p = document.createElement('p'); p.textContent = value; return p.innerHTML; }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function render() {
  const entries = visibleChannels();
  const groups = [...new Set(state.channels.map(c => c.group))].sort((a,b) => a.localeCompare(b, 'ar'));
  $('#channelCount').textContent = state.channels.length;
  $('#favoriteCount').textContent = state.favorites.size;
  $('#groups').innerHTML = groups.map(group => `<button class="group ${state.group === group ? 'active' : ''}" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join('');
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.view === state.view && !state.group));
  const area = $('#channels'); const empty = $('#empty');
  empty.hidden = state.channels.length > 0; area.hidden = state.channels.length === 0;
  area.innerHTML = entries.map(channel => `<article class="channel" data-id="${encodeURIComponent(channel.id)}"><div class="channel-thumb">${channel.logo ? `<img src="${escapeAttr(channel.logo)}" alt="" onerror="this.remove()">` : '<span class="fallback-logo">▶</span>'}<button class="star ${state.favorites.has(channel.id) ? 'on' : ''}" aria-label="المفضلة">★</button></div><div class="channel-info"><strong class="channel-name">${escapeHtml(channel.name)}</strong><span class="channel-group">${escapeHtml(channel.group)}</span></div></article>`).join('') || '<p class="no-results">لا توجد قنوات مطابقة.</p>';
  $('#status').textContent = state.channels.length ? `${entries.length} قناة معروضة من أصل ${state.channels.length}` : 'أضف قائمة M3U خاصة بك للبدء.';
}
function saveFavorites() { localStorage.setItem('fixab-favorites', JSON.stringify([...state.favorites])); }
function openPlayer(channel) {
  const video = $('#player'); $('#nowPlaying').textContent = channel.name; $('#playerMessage').textContent = '';
  if (hls) { hls.destroy(); hls = null; } video.pause(); video.removeAttribute('src'); video.load();
  if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = channel.url; }
  else if (window.Hls?.isSupported()) { hls = new Hls(); hls.loadSource(channel.url); hls.attachMedia(video); hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) $('#playerMessage').textContent = 'تعذّر تشغيل البث. تأكّد من الرابط ومن صلاحية وصولك إليه.'; }); }
  else { $('#playerMessage').textContent = 'هذا المتصفح لا يدعم هذا النوع من البث.'; }
  $('#playerDialog').showModal(); video.play().catch(() => {});
}
async function loadPlaylist() {
  const file = $('#playlistFile').files[0]; const url = $('#playlistUrl').value.trim();
  try {
    $('#loadPlaylist').disabled = true; $('#loadPlaylist').textContent = 'جارٍ التحميل…';
    const text = file ? await file.text() : await fetch(url).then(r => { if (!r.ok) throw new Error(); return r.text(); });
    const channels = parsePlaylist(text); if (!channels.length) throw new Error('empty');
    state.channels = channels; state.group = null; state.view = 'all'; $('#sourceDialog').close(); render();
  } catch { alert('تعذّر تحميل القائمة. تأكّد من أن الملف بصيغة M3U أو أن الرابط متاح في المتصفح.'); }
  finally { $('#loadPlaylist').disabled = false; $('#loadPlaylist').textContent = 'تحميل القائمة'; }
}
$('#openSource').onclick = () => $('#sourceDialog').showModal(); $('#emptyAdd').onclick = () => $('#sourceDialog').showModal();
$('#sourceForm').addEventListener('submit', e => { e.preventDefault(); loadPlaylist(); });
$('#search').addEventListener('input', e => { state.search = e.target.value; render(); });
document.querySelector('.sidebar').addEventListener('click', e => { const nav = e.target.closest('.nav'); const group = e.target.closest('.group'); if (nav) { state.view = nav.dataset.view; state.group = null; render(); } if (group) { state.group = group.dataset.group; state.view = 'all'; render(); } });
$('#channels').addEventListener('click', e => { const card = e.target.closest('.channel'); if (!card) return; const channel = state.channels.find(c => c.id === decodeURIComponent(card.dataset.id)); if (e.target.closest('.star')) { state.favorites.has(channel.id) ? state.favorites.delete(channel.id) : state.favorites.add(channel.id); saveFavorites(); render(); } else openPlayer(channel); });
$('#closePlayer').onclick = () => { $('#player').pause(); $('#playerDialog').close(); };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js'); render();
