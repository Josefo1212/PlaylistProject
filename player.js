const STORAGE = {
  FAVORITES: 'playlistapp_favorites',
  HISTORY: 'playlistapp_history',
  METADATA: 'playlistapp_metadata',
  METADATA_VER: 'playlistapp_metadata_version',
  QUEUE: 'playlistapp_queue',
  VOLUME: 'playlistapp_volume',
  REPEAT: 'playlistapp_repeat',
  SHUFFLE: 'playlistapp_shuffle',
  LAST_PLAYED: 'playlistapp_last_played'
};

const CACHE_VERSION = 4;

const DEFAULT_COVER = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5B4B8A"/><stop offset="100%" stop-color="#3B4CCA"/>
    </linearGradient></defs>
    <rect width="300" height="300" fill="url(#g)"/>
    <path d="M120 95v110l85-55z" fill="rgba(255,255,255,0.85)"/>
    <circle cx="130" cy="210" r="18" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="3"/>
    <circle cx="200" cy="195" r="18" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="3"/>
  </svg>`
);

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function encodePath(p) {
  return p.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parsePath(path) {
  const parts = path.split('/').filter(Boolean);
  const rawName = parts.pop().replace(/\.mp3$/i, '');

  const afterBase = parts.slice(3);
  const artist = afterBase[0] || 'Desconocido';
  const album = afterBase[1] || 'Demo';

  let name = rawName
    .replace(/(\s*\(\d+\)\s*)+$/g, '')
    .replace(/[-_]?\s*320\s*$/i, '')
    .trim();

  if (name.includes(' - ')) {
    name = name.split(' - ')[0].trim();
  } else if (name.includes('- ')) {
    name = name.split('- ')[0].trim();
  }

  name = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  if (artist && artist !== 'Desconocido') {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp('\\s*' + escaped + '\\s*', 'gi'), ' ').trim();
  }

  name = name.replace(/^[-_]\s*/, '').replace(/\s*[-_]$/, '').trim();

  return { title: name || rawName, artist, album };
}

function getCoverFromDir(path) {
  if (typeof COVER_MAP === 'undefined') return null;
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  for (let len = parts.length; len >= 3; len--) {
    const key = parts.slice(0, len).join('/');
    if (COVER_MAP[key]) return COVER_MAP[key];
  }
  return null;
}

function parseLRC(text) {
  const lines = text.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].slice(0, 2).padEnd(2, '0'));
      result.push({ time: min * 60 + sec + ms / 100, text: match[4].trim() });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

class MetadataCache {
  constructor() { this.key = STORAGE.METADATA; }

  _all() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; }
  }

  save(id, data) {
    const all = this._all();
    all[id] = data;
    try { localStorage.setItem(this.key, JSON.stringify(all)); } catch {}
  }

  load(id) { return this._all()[id] || null; }
  clear() { localStorage.removeItem(this.key); }
  has(id) { return id in this._all(); }
}

class PlayQueue {
  constructor() { this.queue = []; this.index = -1; }

  set(tracks, startId) {
    this.queue = [...tracks];
    if (startId != null) this.index = this.queue.findIndex(t => t.id === startId);
  }

  add(track) { this.queue.push(track); }
  remove(index) { this.queue.splice(index, 1); }
  clear() { this.queue = []; this.index = -1; }
  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.index = 0;
  }
  current() { return this.queue[this.index] || null; }
  next() {
    if (this.queue.length === 0) return null;
    this.index = (this.index + 1) % this.queue.length;
    return this.current();
  }
  prev() { this.index = Math.max(this.index - 1, 0); return this.current(); }
  findById(id) {
    const i = this.queue.findIndex(t => t.id === id);
    if (i >= 0) { this.index = i; return true; }
    return false;
  }
}

class ToastManager {
  constructor() {
    this.container = $('#toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = {
      success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
      error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
      info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
    };
    toast.innerHTML = `<span class="toast__icon">${icons[type] || icons.info}</span><span class="toast__msg">${message}</span>`;
    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  success(msg) { this.show(msg, 'success'); }
  error(msg) { this.show(msg, 'error'); }
  info(msg) { this.show(msg, 'info'); }
}

class PlaylistApp {
  constructor() {
    this.tracks = [];
    this.currentTrack = null;
    this.currentIndex = -1;
    this.isPlaying = false;
    this.shuffle = false;
    this.repeat = 'off';
    this.volume = 0.8;
    this.muted = false;
    this.favorites = new Set();
    this.history = [];
    this.activeSection = 'home';
    this.searchQuery = '';
    this.filterGenre = '';
    this.sortBy = 'title';
    this.usingFallback = false;

    this.audio = new Audio();
    this.cache = new MetadataCache();
    this.queue = new PlayQueue();
    this.toast = new ToastManager();

    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.dataArray = null;
    this.visualizerActive = false;

    this.vinylAngle = 0;
    this.vinylSpeed = 0;
    this.vinylTargetSpeed = 0;
    this.vinylRAF = null;

    this.lyrics = [];
    this.lyricsIndex = -1;

    this.colorCanvas = null;
    this.colorCtx = null;
  }

  async init() {
    if (!sessionStorage.getItem('currentUser')) {
      window.location.href = 'index.html';
      return;
    }

    this.colorCanvas = $('#colorCanvas');
    this.colorCtx = this.colorCanvas ? this.colorCanvas.getContext('2d') : null;

    this.loadPersistedState();
    this.cacheDOM();
    this.setupEvents();
    this.updateVolumeUI();
    this.updateUserAvatar();
    this.startVinylAnimation();
    await this.loadTracks();
    this.renderAll();
    this.toast.info(`Biblioteca cargada: ${this.tracks.length} canciones`);
  }

  cacheDOM() {
    this.els = {
      sidebar:        $('#sidebar'),
      sidebarOverlay: $('#sidebarOverlay'),
      sidebarUser:    $('#sidebarUser'),
      menuToggle:     $('#menuToggle'),
      searchInput:    $('#searchInput'),
      btnLogout:      $('#btnLogout'),
      btnHelp:        $('#btnHelp'),
      sortBy:         $('#sortBy'),
      genreChips:     $('#genreChips'),
      exploreCount:   $('#exploreCount'),
      greeting:       $('#greeting'),
      userName:       $('#userName'),
      featuredCard:   $('#featuredCard'),
      heroCover:      $('#heroCover'),
      recentCarousel: $('#recentCarousel'),
      recommendedGrid:$('#recommendedGrid'),
      exploreGrid:    $('#exploreGrid'),
      libraryGrid:    $('#libraryGrid'),
      libraryCount:   $('#libraryCount'),
      favoritesGrid:  $('#favoritesGrid'),
      favoritesCount: $('#favoritesCount'),
      favoritesEmpty: $('#favoritesEmpty'),
      vinyl:          $('#vinyl'),
      vinylCover:     $('#vinylCover'),
      vinylFallback:  $('#vinylFallback'),
      turntableGlow:  $('#turntableGlow'),
      turntableArm:   $('#turntableArm'),
      playerTitle:    $('#playerTitle'),
      playerArtist:   $('#playerArtist'),
      playerAlbum:    $('#playerAlbum'),
      playerFav:      $('#playerFav'),
      btnPlay:        $('#btnPlay'),
      btnPrev:        $('#btnPrev'),
      btnNext:        $('#btnNext'),
      btnShuffle:     $('#btnShuffle'),
      btnRepeat:      $('#btnRepeat'),
      btnMute:        $('#btnMute'),
      currentTime:    $('#currentTime'),
      totalTime:      $('#totalTime'),
      progressBar:    $('#progressBar'),
      progressFill:   $('#progressFill'),
      progressThumb:  $('#progressThumb'),
      volumeBar:      $('#volumeBar'),
      volumeFill:     $('#volumeFill'),
      volumeThumb:    $('#volumeThumb'),
      queueList:      $('#queueList'),
      queuePanel:     $('#queuePanel'),
      btnQueue:       $('#btnQueue'),
      btnQueueClose:  $('#btnQueueClose'),
      visualizer:     $('#visualizer'),
      helpModal:      $('#helpModal'),
      loadingBar:     $('#loadingBar'),
      lyricsBody:     $('#lyricsBody'),
      dynamicBg:      $('#dynamicBg')
    };
  }

  startVinylAnimation() {
    const animate = () => {
      const diff = this.vinylTargetSpeed - this.vinylSpeed;
      this.vinylSpeed += diff * 0.04;
      if (Math.abs(diff) < 0.0005) this.vinylSpeed = this.vinylTargetSpeed;

      this.vinylAngle += this.vinylSpeed * 2.8;
      if (this.vinylAngle >= 360) this.vinylAngle -= 360;

      if (this.els.vinyl) {
        this.els.vinyl.style.transform = `rotate(${this.vinylAngle}deg)`;
      }

      if (Math.abs(this.vinylSpeed) < 0.0001 && Math.abs(this.vinylTargetSpeed) < 0.0001) {
        this.vinylRAF = null;
        return;
      }

      this.vinylRAF = requestAnimationFrame(animate);
    };
    this.vinylRAF = requestAnimationFrame(animate);
  }

  setVinylPlaying(playing) {
    this.vinylTargetSpeed = playing ? 1 : 0;
    if (this.vinylRAF === null) {
      this.startVinylAnimation();
    }
  }

  extractColors(img) {
    if (!this.colorCanvas || !this.colorCtx || !img.complete || img.naturalWidth === 0) return;

    try {
      const cw = 64, ch = 64;
      this.colorCanvas.width = cw;
      this.colorCanvas.height = ch;
      this.colorCtx.drawImage(img, 0, 0, cw, ch);
      const data = this.colorCtx.getImageData(0, 0, cw, ch).data;

      let r = 0, g = 0, b = 0, count = 0;
      let r2 = 0, g2 = 0, b2 = 0, count2 = 0;

      for (let i = 0; i < data.length; i += 16) {
        const ri = data[i], gi = data[i+1], bi = data[i+2];
        const brightness = (ri + gi + bi) / 3;
        if (brightness > 80 && brightness < 220) {
          r += ri; g += gi; b += bi; count++;
        }
        if (brightness < 100) {
          r2 += ri; g2 += gi; b2 += bi; count2++;
        }
      }

      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        const root = document.documentElement;
        root.style.setProperty('--dyn-color-1', `rgb(${r},${g},${b})`);
      }

      if (count2 > 0) {
        r2 = Math.round(r2 / count2);
        g2 = Math.round(g2 / count2);
        b2 = Math.round(b2 / count2);
        document.documentElement.style.setProperty('--dyn-color-2', `rgb(${r2},${g2},${b2})`);
      }
    } catch {}
  }

  setDynamicBg(coverSrc) {
    if (!this.els.dynamicBg) return;
    if (!coverSrc || coverSrc === DEFAULT_COVER) {
      this.els.dynamicBg.style.opacity = '0';
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.extractColors(img);
      this.els.dynamicBg.style.opacity = '1';
    };
    img.onerror = () => {
      this.els.dynamicBg.style.opacity = '0';
    };
    img.src = coverSrc;
  }

  async loadLyrics(track) {
    this.lyrics = [];
    this.lyricsIndex = -1;
    if (!this.els.lyricsBody) return;

    if (!track || !track.path) {
      this.els.lyricsBody.innerHTML = '<div class="lyrics__empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span>Selecciona una cancion</span></div>';
      return;
    }

    const mp3Path = track.path;
    const lrcPath = mp3Path.replace(/\.mp3$/i, '.lrc');
    const txtPath = mp3Path.replace(/\.mp3$/i, '.txt');

    try {
      const res = await fetch(encodePath(lrcPath));
      if (res.ok) {
        const text = await res.text();
        this.lyrics = parseLRC(text);
        this.renderLyricsLines();
        return;
      }
    } catch {}

    try {
      const res = await fetch(encodePath(txtPath));
      if (res.ok) {
        const text = await res.text();
        this.els.lyricsBody.innerHTML = `<div class="lyrics__line" style="white-space:pre-wrap;line-height:1.9;">${this.escapeHtml(text)}</div>`;
        return;
      }
    } catch {}

    this.els.lyricsBody.innerHTML = '<div class="lyrics__empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span>No hay letra disponible</span></div>';
  }

  renderLyricsLines() {
    if (!this.els.lyricsBody || !this.lyrics.length) return;
    this.els.lyricsBody.innerHTML = this.lyrics
      .map((l, i) => `<div class="lyrics__line" data-idx="${i}">${this.escapeHtml(l.text) || '&nbsp;'}</div>`)
      .join('');
  }

  updateLyricsSync() {
    if (!this.lyrics.length) return;
    const time = this.audio.currentTime;
    let idx = -1;
    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      if (time >= this.lyrics[i].time - 0.3) { idx = i; break; }
    }
    if (idx === this.lyricsIndex) return;
    this.lyricsIndex = idx;

    const lines = this.els.lyricsBody.querySelectorAll('.lyrics__line');
    lines.forEach((el, i) => {
      el.classList.remove('lyrics__line--active', 'lyrics__line--past');
      if (i === idx) el.classList.add('lyrics__line--active');
      else if (i < idx) el.classList.add('lyrics__line--past');
    });

    if (idx >= 0 && lines[idx]) {
      lines[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async loadTracks() {
    this.showLoading(true);
    console.log(`Cargando ${songs.length} canciones...`);

    const storedVer = parseInt(localStorage.getItem(STORAGE.METADATA_VER)) || 0;
    if (storedVer < CACHE_VERSION) {
      this.cache.clear();
      localStorage.setItem(STORAGE.METADATA_VER, String(CACHE_VERSION));
      console.log('Cache bumped — metadata reloaded');
    }

    const promises = songs.map((path, i) => {
      const cacheKey = `track_${i}`;

      const cached = this.cache.load(cacheKey);
      if (cached) {
        console.log(`✓ Metadata loaded (cache): ${cached.title}`);
        return Promise.resolve({ id: i, path, ...cached });
      }

      return this.readTags(path)
        .then(tags => {
          this.cache.save(cacheKey, tags);
          return { id: i, path, ...tags };
        })
        .catch(() => {
          const info = parsePath(path);
          const fallback = {
            title: info.title,
            artist: info.artist || 'Desconocido',
            album: info.album,
            genre: 'Sin genero',
            year: null,
            cover: getCoverFromDir(path)
          };
          console.warn(`✗ Metadata missing: ${path}`);
          this.cache.save(cacheKey, fallback);
          return { id: i, path, ...fallback };
        });
    });

    const loaded = await Promise.all(promises);

    if (loaded.length === 0 || loaded.every(t => !t.path)) {
      this.usingFallback = true;
      this.toast.info('Usando canciones de demostracion');
      FALLBACK_SONGS.forEach((s, i) => {
        loaded.push({ id: i, path: null, ...s, cover: null });
      });
    }

    this.tracks = loaded;

    const genres = [...new Set(this.tracks.map(t => t.genre))].sort();
    this.renderGenreChips(genres);

    this.queue.set(this.tracks, null);
    this.showLoading(false);
    console.log(`✓ ${this.tracks.length} canciones cargadas`);
  }

  renderGenreChips(genres) {
    const container = this.els.genreChips;
    if (!container) return;
    container.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'genre-chip active';
    allChip.dataset.genre = '';
    allChip.textContent = 'Todos';
    container.appendChild(allChip);

    genres.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'genre-chip';
      chip.dataset.genre = g;
      chip.textContent = g;
      container.appendChild(chip);
    });

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.genre-chip');
      if (!chip) return;
      container.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.filterGenre = chip.dataset.genre;
      this.renderExplore();
    });
  }

  readTags(path) {
    return new Promise((resolve, reject) => {
      if (typeof jsmediatags === 'undefined') {
        reject(new Error('jsmediatags not loaded'));
        return;
      }
      const fallback = parsePath(path);
      const dirCover = getCoverFromDir(path);
      jsmediatags.read(encodePath(path), {
        onSuccess: (tag) => {
          const t = tag.tags;
          const cover = dirCover || (t.picture ? this.pictureToDataURL(t.picture) : null);
          const data = {
            title:  fallback.title,
            artist: fallback.artist || 'Desconocido',
            album:  fallback.album,
            genre:  t.genre  || 'Sin genero',
            year:   t.year   || null,
            cover:  cover
          };
          console.log(`✓ Metadata loaded: ${data.title} — ${data.artist}`);
          if (t.picture) console.log(`✓ Cover loaded (embedded): ${data.title}`);
          else if (dirCover) console.log(`✓ Cover loaded (folder): ${data.title}`);
          else console.log(`✗ Cover missing: ${data.title}`);
          resolve(data);
        },
        onError: (err) => {
          console.warn(`✗ Failed to read tags: ${path}`, err);
          reject(new Error('Failed to read tags'));
        }
      });
    });
  }

  pictureToDataURL(pic) {
    if (!pic || !pic.data) return null;
    let bytes;
    if (Array.isArray(pic.data)) {
      bytes = new Uint8Array(pic.data);
    } else {
      bytes = new Uint8Array(pic.data.length);
      for (let i = 0; i < pic.data.length; i++) bytes[i] = pic.data.charCodeAt(i);
    }
    const mime = pic.format || 'image/jpeg';
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  showLoading(show) {
    if (this.els.loadingBar) {
      this.els.loadingBar.style.display = show ? 'flex' : 'none';
      if (!show) this.els.loadingBar.querySelector('.loading-bar__fill').style.width = '0%';
    }
  }

  renderAll() {
    this.renderHome();
    this.renderExplore();
    this.renderLibrary();
    this.renderFavorites();
  }

  renderHome() {
    const h = new Date().getHours();
    this.els.greeting.textContent = h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos dias' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    try {
      const user = JSON.parse(sessionStorage.getItem('currentUser'));
      if (user?.name) this.els.userName.textContent = `Hola, ${user.name}`;
    } catch {}

    const feat = this.tracks[this.history.length > 0 ? this.history[this.history.length - 1] : 0];
    if (feat) {
      const heroBg = $('#heroBg');
      const heroCover = $('#heroCover');
      const heroTitle = $('#heroTitle');
      const heroArtist = $('#heroArtist');
      const heroLabel = $('#heroLabel');

      heroLabel.textContent = this.usingFallback ? 'Demo' : 'Escuchando ahora';
      heroTitle.textContent = feat.title;
      heroArtist.textContent = feat.artist;

      const coverSrc = feat.cover || DEFAULT_COVER;
      heroBg.innerHTML = `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;">`;
      heroCover.src = coverSrc;
      heroCover.style.display = '';

      const heroPlayBtn = $('#heroPlay');
      heroPlayBtn.onclick = (e) => { e.stopPropagation(); this.playTrack(feat.id); };

      const heroFavBtn = $('#heroFav');
      heroFavBtn.classList.toggle('is-fav', this.favorites.has(feat.id));
      heroFavBtn.onclick = (e) => { e.stopPropagation(); this.toggleFavorite(feat.id); };

      this.els.featuredCard.onclick = () => this.playTrack(feat.id);
    }

    this.els.recentCarousel.innerHTML = '';
    const recent = this.history.slice(-10).reverse();
    if (recent.length === 0) {
      this.els.recentCarousel.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem;">Aun no has escuchado nada</span>';
    } else {
      recent.forEach(id => {
        const t = this.tracks.find(x => x.id === id);
        if (t) this.els.recentCarousel.appendChild(this.createSongCard(t));
      });
    }

    this.els.recommendedGrid.innerHTML = '';
    [...this.tracks].sort(() => Math.random() - 0.5).slice(0, 10)
      .forEach(t => this.els.recommendedGrid.appendChild(this.createSongCard(t)));
  }

  renderExplore() {
    this.els.exploreGrid.innerHTML = '';
    const filtered = this.getFilteredTracks();
    if (this.els.exploreCount) {
      this.els.exploreCount.textContent = `${filtered.length} de ${this.tracks.length} canciones`;
    }
    if (filtered.length === 0) {
      this.els.exploreGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No se encontraron canciones</p></div>';
    } else {
      filtered.forEach(t => this.els.exploreGrid.appendChild(this.createSongCard(t)));
    }
  }

  renderLibrary() {
    this.els.libraryGrid.innerHTML = '';
    this.els.libraryCount.textContent = `(${this.tracks.length})`;
    this.tracks.forEach(t => this.els.libraryGrid.appendChild(this.createSongCard(t)));
  }

  renderFavorites() {
    this.els.favoritesGrid.innerHTML = '';
    const favs = this.tracks.filter(t => this.favorites.has(t.id));
    this.els.favoritesCount.textContent = `(${favs.length})`;
    if (favs.length === 0) {
      this.els.favoritesEmpty.style.display = 'block';
    } else {
      this.els.favoritesEmpty.style.display = 'none';
      favs.forEach(t => this.els.favoritesGrid.appendChild(this.createSongCard(t)));
    }
  }

  renderQueue() {
    if (!this.els.queueList) return;
    this.els.queueList.innerHTML = '';
    this.queue.queue.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'queue-item' + (this.currentTrack?.id === t.id ? ' queue-item--active' : '');
      item.innerHTML = `
        <span class="queue-item__num">${i + 1}</span>
        <div class="queue-item__info">
          <span class="queue-item__title">${t.title}</span>
          <span class="queue-item__artist">${t.artist}</span>
        </div>
        <button class="queue-item__remove" data-index="${i}" aria-label="Quitar">&times;</button>`;
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.queue-item__remove')) this.playTrack(t.id);
      });
      this.els.queueList.appendChild(item);
    });

    this.els.queueList.querySelectorAll('.queue-item__remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.queue.remove(idx);
        this.renderQueue();
      });
    });
  }

  createSongCard(track) {
    const card = document.createElement('div');
    card.className = 'song-card' + (this.currentTrack?.id === track.id ? ' playing' : '');
    card.dataset.id = track.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${track.title} - ${track.artist}`);

    const coverSrc = track.cover || DEFAULT_COVER;
    const isFav = this.favorites.has(track.id);

    card.innerHTML = `
      <div class="song-card__cover-wrap">
        <div class="song-card__glow" style="background:url(${coverSrc}) center/cover"></div>
        <img class="song-card__cover" src="${coverSrc}" alt="${track.title}" loading="lazy">
        <div class="song-card__play-overlay">
          <div class="song-card__play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div class="song-card__body">
        <div class="song-card__text">
          <div class="song-card__title">${track.title}</div>
          <div class="song-card__artist">${track.artist}</div>
        </div>
        <button class="song-card__fav ${isFav ? 'is-fav' : ''}" data-fav-id="${track.id}" aria-label="Favorito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
      </div>`;

    return card;
  }

  switchSection(name) {
    this.activeSection = name;
    $$('.section').forEach(s => s.classList.remove('active'));
    $(`#section-${name}`)?.classList.add('active');
    $$('.sidebar__link').forEach(l => l.classList.remove('active'));
    $(`.sidebar__link[data-section="${name}"]`)?.classList.add('active');
    this.els.sidebar.classList.remove('open');
    this.els.sidebarOverlay.classList.remove('visible');
    if (name === 'home') this.renderHome();
    if (name === 'explore') this.renderExplore();
    if (name === 'favorites') this.renderFavorites();
  }

  async playTrack(id) {
    const track = this.tracks.find(t => t.id === id);
    if (!track) return;

    if (!track.path) {
      this.currentTrack = track;
      this.currentIndex = this.tracks.indexOf(track);
      this.updatePlayerUI();
      this.updatePlayingCard();
      this.toast.info(`Reproduciendo demo: ${track.title}`);
      return;
    }

    this.currentTrack = track;
    this.currentIndex = this.tracks.indexOf(track);
    this.isPlaying = true;

    this.initAudioContext();

    this.audio.src = encodePath(track.path);
    this.audio.load();
    try { await this.audio.play(); } catch (e) {
      this.toast.error('No se pudo reproducir este archivo');
      console.warn('Play error:', e);
      return;
    }

    this.queue.findById(id);

    this.history = this.history.filter(h => h !== id);
    this.history.push(id);
    if (this.history.length > 50) this.history.shift();
    this.saveHistory();

    this.saveLastPlayed(id);

    if (!this.usingFallback) {
      const cacheKey = `track_${id}`;
      const cached = this.cache.load(cacheKey);
      if (cached) {
        cached.plays = (cached.plays || 0) + 1;
        cached.lastPlayed = new Date().toISOString();
        this.cache.save(cacheKey, cached);
      }
    }

    this.updatePlayerUI();
    this.updatePlayingCard();
    this.renderQueue();
    if (this.activeSection === 'home') this.renderHome();
    if (this.activeSection === 'favorites') this.renderFavorites();
    this.toast.success(`Reproduciendo: ${track.title}`);
  }

  togglePlay() {
    if (!this.currentTrack) return;
    if (this.currentTrack?.path) {
      this.initAudioContext();
      if (this.isPlaying) { this.audio.pause(); }
      else { this.audio.play().catch(() => {}); }
    }
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();

    this.setVinylPlaying(this.isPlaying);

    if (this.els.turntableArm) this.els.turntableArm.classList.toggle('playing', this.isPlaying);
    if (this.els.turntableGlow) this.els.turntableGlow.classList.toggle('active', this.isPlaying);

    if (this.visualizerActive) this.drawVisualizer();
  }

  playNext() {
    if (this.tracks.length === 0) return;
    if (this.queue.findById(this.currentTrack?.id)) {
      const next = this.queue.next();
      if (next) { this.playTrack(next.id); return; }
    }
    let idx;
    if (this.shuffle) idx = Math.floor(Math.random() * this.tracks.length);
    else idx = (this.currentIndex + 1) % this.tracks.length;
    this.playTrack(this.tracks[idx].id);
  }

  playPrev() {
    if (this.tracks.length === 0) return;
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    let idx;
    if (this.shuffle) idx = Math.floor(Math.random() * this.tracks.length);
    else idx = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playTrack(this.tracks[idx].id);
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.els.btnShuffle.classList.toggle('active', this.shuffle);
    if (this.shuffle) this.queue.shuffle();
    else this.queue.set(this.tracks, this.currentTrack?.id);
    this.savePrefs();
    this.toast.info(this.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado');
  }

  toggleRepeat() {
    const modes = ['off', 'all', 'one'];
    this.repeat = modes[(modes.indexOf(this.repeat) + 1) % 3];
    this.els.btnRepeat.classList.toggle('active', this.repeat !== 'off');
    const badge = this.els.btnRepeat.querySelector('.repeat-badge');
    if (badge) badge.remove();
    if (this.repeat === 'one') {
      const b = document.createElement('span');
      b.className = 'repeat-badge';
      b.textContent = '1';
      this.els.btnRepeat.appendChild(b);
    }
    this.savePrefs();
    const labels = { off: 'Repetir desactivado', all: 'Repetir todas', one: 'Repetir una' };
    this.toast.info(labels[this.repeat]);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.muted = this.muted;
    this.els.btnMute.querySelector('.icon-vol').style.display = this.muted ? 'none' : '';
    this.els.btnMute.querySelector('.icon-mute').style.display = this.muted ? '' : 'none';
    this.updateVolumeUI();
  }

  initAudioContext() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.gainNode = this.audioCtx.createGain();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.visualizerActive = true;
      this.drawVisualizer();
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  drawVisualizer() {
    if (!this.visualizerActive || !this.els.visualizer) return;
    requestAnimationFrame(() => this.drawVisualizer());
    if (!this.isPlaying) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    const canvas = this.els.visualizer;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, W, H);

    const bars = this.dataArray.length;
    const barW = (W / bars) * 1.5;
    let x = 0;

    for (let i = 0; i < bars; i++) {
      const barH = (this.dataArray[i] / 255) * H * 0.85;
      const hue = 220 + (i / bars) * 60;
      ctx.fillStyle = `hsla(${hue}, 60%, 65%, ${0.3 + (this.dataArray[i] / 255) * 0.4})`;
      ctx.fillRect(x, H - barH, barW - 1, barH);
      x += barW;
    }
  }

  toggleFavorite(id) {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      this.toast.info('Eliminado de favoritos');
    } else {
      this.favorites.add(id);
      this.toast.success('Agregado a favoritos');
    }
    this.saveFavorites();
    this.updateFavButton();
    this.updateFavCards();
    if (this.activeSection === 'favorites') this.renderFavorites();
  }

  updateFavCards() {
    $$('.song-card__fav').forEach(btn => {
      const id = parseInt(btn.dataset.favId);
      btn.classList.toggle('is-fav', this.favorites.has(id));
    });
  }

  getFilteredTracks() {
    let list = [...this.tracks];
    const q = this.searchQuery.toLowerCase();
    if (q) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q)
      );
    }
    if (this.filterGenre) list = list.filter(t => t.genre === this.filterGenre);
    const key = this.sortBy;
    list.sort((a, b) => (a[key] || '').toString().localeCompare((b[key] || '').toString()));
    return list;
  }

  updatePlayerUI() {
    const t = this.currentTrack;
    if (!t) return;
    this.els.playerTitle.textContent = t.title;
    this.els.playerArtist.textContent = t.artist;
    if (this.els.playerAlbum) this.els.playerAlbum.textContent = t.album || '';

    const coverSrc = t.cover || DEFAULT_COVER;

    if (this.els.vinylCover) {
      if (t.cover) {
        this.els.vinylCover.src = t.cover;
        this.els.vinylCover.style.display = '';
        if (this.els.vinylFallback) this.els.vinylFallback.style.display = 'none';
      } else {
        this.els.vinylCover.style.display = 'none';
        if (this.els.vinylFallback) this.els.vinylFallback.style.display = '';
      }
    }

    this.setVinylPlaying(this.isPlaying);

    if (this.els.turntableArm) {
      this.els.turntableArm.classList.toggle('playing', this.isPlaying);
    }

    if (this.els.turntableGlow) {
      this.els.turntableGlow.classList.toggle('active', this.isPlaying);
    }

    this.updatePlayButton();
    this.updateFavButton();
    document.title = `${t.title} - ${t.artist} | PlaylistApp`;

    this.setDynamicBg(coverSrc);
    this.loadLyrics(t);
  }

  updatePlayButton() {
    this.els.btnPlay.querySelector('.icon-play').style.display = this.isPlaying ? 'none' : '';
    this.els.btnPlay.querySelector('.icon-pause').style.display = this.isPlaying ? '' : 'none';
    this.els.btnPlay.classList.toggle('is-playing', this.isPlaying);
  }

  updatePlayingCard() {
    $$('.song-card').forEach(c => c.classList.remove('playing'));
    if (this.currentTrack) {
      const c = document.querySelector(`.song-card[data-id="${this.currentTrack.id}"]`);
      if (c) c.classList.add('playing');
    }
  }

  updateFavButton() {
    if (!this.currentTrack) return;
    this.els.playerFav.classList.toggle('is-fav', this.favorites.has(this.currentTrack.id));
  }

  updateProgress() {
    if (!this.audio.duration) return;
    const pct = (this.audio.currentTime / this.audio.duration) * 100;
    this.els.progressFill.style.width = pct + '%';
    this.els.progressThumb.style.left = pct + '%';
    this.els.currentTime.textContent = formatTime(this.audio.currentTime);
    this.els.totalTime.textContent = formatTime(this.audio.duration);
    this.updateLyricsSync();
  }

  updateVolumeUI() {
    const vol = this.muted ? 0 : this.volume;
    this.els.volumeFill.style.width = (vol * 100) + '%';
    this.els.volumeThumb.style.left = (vol * 100) + '%';
  }

  updateUserAvatar() {
    try {
      const user = JSON.parse(sessionStorage.getItem('currentUser'));
      if (user && this.els.sidebarUser) {
        const initials = ((user.name || '')[0] || '') + ((user.lastname || '')[0] || '');
        this.els.sidebarUser.innerHTML = `
          <div class="user-avatar">${initials.toUpperCase() || '?'}</div>
          <span>${user.username || user.name || 'Usuario'}</span>`;
      }
    } catch {}
  }

  saveFavorites() { localStorage.setItem(STORAGE.FAVORITES, JSON.stringify([...this.favorites])); }
  loadFavorites() { try { const d = JSON.parse(localStorage.getItem(STORAGE.FAVORITES)); if (Array.isArray(d)) this.favorites = new Set(d); } catch {} }
  saveHistory() { localStorage.setItem(STORAGE.HISTORY, JSON.stringify(this.history)); }
  loadHistory() { try { const d = JSON.parse(localStorage.getItem(STORAGE.HISTORY)); if (Array.isArray(d)) this.history = d; } catch {} }
  saveLastPlayed(id) { localStorage.setItem(STORAGE.LAST_PLAYED, String(id)); }
  loadLastPlayed() { return parseInt(localStorage.getItem(STORAGE.LAST_PLAYED)) || null; }
  savePrefs() {
    localStorage.setItem(STORAGE.VOLUME, String(this.volume));
    localStorage.setItem(STORAGE.REPEAT, this.repeat);
    localStorage.setItem(STORAGE.SHUFFLE, String(this.shuffle));
  }
  loadPrefs() {
    this.volume = parseFloat(localStorage.getItem(STORAGE.VOLUME)) || 0.8;
    this.repeat = localStorage.getItem(STORAGE.REPEAT) || 'off';
    this.shuffle = localStorage.getItem(STORAGE.SHUFFLE) === 'true';
    this.audio.volume = this.volume;
  }

  loadPersistedState() {
    this.loadFavorites();
    this.loadHistory();
    this.loadPrefs();
  }

  setupEvents() {
    $$('.sidebar__link').forEach(link => {
      link.addEventListener('click', (e) => { e.preventDefault(); this.switchSection(link.dataset.section); });
    });

    this.els.menuToggle?.addEventListener('click', () => {
      this.els.sidebar.classList.toggle('open');
      this.els.sidebarOverlay.classList.toggle('visible');
    });
    this.els.sidebarOverlay?.addEventListener('click', () => {
      this.els.sidebar.classList.remove('open');
      this.els.sidebarOverlay.classList.remove('visible');
    });

    this.els.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderExplore();
      if (this.activeSection !== 'explore') this.switchSection('explore');
    });

    this.els.sortBy?.addEventListener('change', (e) => { this.sortBy = e.target.value; this.renderExplore(); });

    document.addEventListener('click', (e) => {
      const favBtn = e.target.closest('.song-card__fav');
      if (favBtn) {
        e.stopPropagation();
        this.toggleFavorite(parseInt(favBtn.dataset.favId));
        return;
      }

      const card = e.target.closest('.song-card');
      if (card) this.playTrack(parseInt(card.dataset.id));

      if (e.target.closest('#playerFav') && this.currentTrack) {
        this.toggleFavorite(this.currentTrack.id);
      }
    });

    this.els.featuredCard?.addEventListener('click', () => {
      if (this.tracks.length > 0) {
        const id = this.history.length > 0 ? this.history[this.history.length - 1] : this.tracks[0].id;
        this.playTrack(id);
      }
    });

    this.els.btnPlay?.addEventListener('click', () => this.togglePlay());
    this.els.btnNext?.addEventListener('click', () => this.playNext());
    this.els.btnPrev?.addEventListener('click', () => this.playPrev());
    this.els.btnShuffle?.addEventListener('click', () => this.toggleShuffle());
    this.els.btnRepeat?.addEventListener('click', () => this.toggleRepeat());
    this.els.btnMute?.addEventListener('click', () => this.toggleMute());

    this.els.btnQueue?.addEventListener('click', () => {
      this.els.queuePanel?.classList.toggle('open');
      this.renderQueue();
    });

    this.els.btnQueueClose?.addEventListener('click', () => {
      this.els.queuePanel?.classList.remove('open');
    });

    this.els.btnHelp?.addEventListener('click', () => this.els.helpModal?.classList.toggle('open'));
    this.els.helpModal?.addEventListener('click', (e) => {
      if (e.target === this.els.helpModal || e.target.closest('.modal__close')) {
        this.els.helpModal.classList.remove('open');
      }
    });

    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => {
      if (this.repeat === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else if (this.repeat === 'all') {
        this.playNext();
      } else if (this.currentIndex < this.tracks.length - 1) {
        this.playNext();
      } else {
        this.isPlaying = false;
        this.updatePlayButton();
        this.setVinylPlaying(false);
      }
    });
    this.audio.addEventListener('play', () => { this.isPlaying = true; this.updatePlayButton(); this.setVinylPlaying(true); });
    this.audio.addEventListener('pause', () => { this.isPlaying = false; this.updatePlayButton(); this.setVinylPlaying(false); });
    this.audio.addEventListener('error', () => {
      this.toast.error('Error al cargar el archivo de audio');
    });

    this.setupDrag(this.els.progressBar, (pct) => {
      if (!this.audio.duration) return;
      this.audio.currentTime = pct * this.audio.duration;
      this.els.progressFill.style.width = (pct * 100) + '%';
      this.els.progressThumb.style.left = (pct * 100) + '%';
    });

    this.setupDrag(this.els.volumeBar, (pct) => {
      this.volume = pct;
      this.audio.volume = this.volume;
      this.muted = false;
      this.audio.muted = false;
      this.els.btnMute.querySelector('.icon-vol').style.display = '';
      this.els.btnMute.querySelector('.icon-mute').style.display = 'none';
      this.updateVolumeUI();
      this.savePrefs();
    });

    this.els.btnLogout?.addEventListener('click', () => {
      sessionStorage.removeItem('currentUser');
      window.location.href = 'index.html';
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); this.togglePlay(); break;
        case 'ArrowRight': if (this.audio.duration) this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 5); break;
        case 'ArrowLeft': this.audio.currentTime = Math.max(0, this.audio.currentTime - 5); break;
        case 'ArrowUp': e.preventDefault(); this.volume = Math.min(1, this.volume + 0.05); this.audio.volume = this.volume; this.updateVolumeUI(); this.savePrefs(); break;
        case 'ArrowDown': e.preventDefault(); this.volume = Math.max(0, this.volume - 0.05); this.audio.volume = this.volume; this.updateVolumeUI(); this.savePrefs(); break;
        case 'KeyN': this.playNext(); break;
        case 'KeyP': this.playPrev(); break;
        case 'KeyM': this.toggleMute(); break;
        case 'KeyS': this.toggleShuffle(); break;
        case 'KeyR': this.toggleRepeat(); break;
        case 'Equal': case 'Slash': e.preventDefault(); this.els.helpModal?.classList.toggle('open'); break;
      }
    });
  }

  setupDrag(el, callback) {
    if (!el) return;
    let dragging = false;
    const fromEvent = (e) => {
      const rect = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    el.addEventListener('click', (e) => callback(fromEvent(e)));
    el.addEventListener('mousedown', (e) => { dragging = true; callback(fromEvent(e)); });
    document.addEventListener('mousemove', (e) => { if (dragging) callback(fromEvent(e)); });
    document.addEventListener('mouseup', () => { dragging = false; });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new PlaylistApp();
  app.init();
});
