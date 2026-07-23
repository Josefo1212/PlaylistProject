window.PlaylistManager = (function () {
  const DB_NAME = 'PlaylistApp';
  const DB_VERSION = 1;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = ({ target: { result: db } }) => {
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          store.createIndex('username', 'username', { unique: true });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          const store = db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
          store.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('songs')) {
          const store = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
          store.createIndex('playlistId', 'playlistId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(name, mode = 'readonly') {
    const db = await openDatabase();
    const tx = db.transaction(name, mode);
    return tx.objectStore(name);
  }

  async function getUserId() {
    try {
      const user = JSON.parse(sessionStorage.getItem('currentUser'));
      return user?.id || null;
    } catch { return null; }
  }

  async function createPlaylist(name, description = '') {
    const userId = await getUserId();
    const playlist = {
      userId,
      name: name.trim(),
      description: description.trim(),
      cover: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const store = await withStore('playlists', 'readwrite');
    playlist.id = await promisify(store.add(playlist));
    return playlist;
  }

  async function updatePlaylist(id, updates) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const playlist = getReq.result;
        if (!playlist) { resolve(null); return; }
        Object.assign(playlist, updates, { updatedAt: new Date().toISOString() });
        store.put(playlist);
        tx.oncomplete = () => resolve(playlist);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async function removePlaylist(id) {
    const db = await openDatabase();
    const readTx = db.transaction('songs', 'readonly');
    const songs = await promisify(readTx.objectStore('songs').index('playlistId').getAll(id));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['songs', 'playlists'], 'readwrite');
      const songsStore = tx.objectStore('songs');
      songs.forEach(s => songsStore.delete(s.id));
      tx.objectStore('playlists').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllPlaylists() {
    const userId = await getUserId();
    const store = await withStore('playlists');
    const all = await promisify(store.index('userId').getAll(userId));
    return all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async function getPlaylist(id) {
    const store = await withStore('playlists');
    return promisify(store.get(id));
  }

  async function addSongToPlaylist(playlistId, trackId) {
    const db = await openDatabase();
    const readTx = db.transaction('songs', 'readonly');
    const readStore = readTx.objectStore('songs');
    const existing = await promisify(readStore.index('playlistId').getAll(playlistId));
    if (existing.some(s => s.trackId === trackId)) return false;

    const order = existing.length;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      tx.objectStore('songs').add({ playlistId, trackId, order });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  }

  async function removeSongFromPlaylist(playlistId, trackId) {
    const db = await openDatabase();
    const readTx = db.transaction('songs', 'readonly');
    const songs = await promisify(readTx.objectStore('songs').index('playlistId').getAll(playlistId));
    const target = songs.find(s => s.trackId === trackId);
    if (target) {
      const remaining = songs.filter(s => s.id !== target.id);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('songs', 'readwrite');
        const store = tx.objectStore('songs');
        store.delete(target.id);
        remaining.forEach((s, i) => { s.order = i; store.put(s); });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async function getPlaylistSongs(playlistId) {
    const store = await withStore('songs');
    const songs = await promisify(store.index('playlistId').getAll(playlistId));
    return songs.sort((a, b) => a.order - b.order);
  }

  async function getPlaylistCover(playlistId) {
    const songs = await getPlaylistSongs(playlistId);
    if (songs.length === 0) return null;
    if (typeof window._appTracks !== 'undefined') {
      const track = window._appTracks.find(t => t.id === songs[0].trackId);
      if (track?.cover) return track.cover;
    }
    return null;
  }

  return {
    createPlaylist,
    updatePlaylist,
    removePlaylist,
    getAllPlaylists,
    getPlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    getPlaylistSongs,
    getPlaylistCover,
    getUserId
  };
})();
