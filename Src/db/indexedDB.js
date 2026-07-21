const DB_NAME = 'PlaylistApp';
const DB_VERSION = 1;

const openDatabase = () =>
    new Promise((resolve, reject) => {
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

const promisifyRequest = (request) =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const withStore = async (storeName, mode = 'readonly') => {
    const db = await openDatabase();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
};

export const addUser = async (user) => {
    const store = await withStore('users', 'readwrite');
    return promisifyRequest(store.add(user));
};

export const getUserByUsername = async (username) => {
    const store = await withStore('users');
    return promisifyRequest(store.index('username').get(username));
};

export const getUserById = async (id) => {
    const store = await withStore('users');
    return promisifyRequest(store.get(id));
};

export const addPlaylist = async (playlist) => {
    const store = await withStore('playlists', 'readwrite');
    return promisifyRequest(store.add(playlist));
};

export const getPlaylistsByUser = async (userId) => {
    const store = await withStore('playlists');
    return promisifyRequest(store.index('userId').getAll(userId));
};

export const deletePlaylist = async (id) => {
    const store = await withStore('playlists', 'readwrite');
    return promisifyRequest(store.delete(id));
};

export const addSong = async (song) => {
    const store = await withStore('songs', 'readwrite');
    return promisifyRequest(store.add(song));
};

export const getSongsByPlaylist = async (playlistId) => {
    const store = await withStore('songs');
    return promisifyRequest(store.index('playlistId').getAll(playlistId));
};

export const deleteSong = async (id) => {
    const store = await withStore('songs', 'readwrite');
    return promisifyRequest(store.delete(id));
};

export const deleteSongsByPlaylist = async (playlistId) => {
    const store = await withStore('songs', 'readwrite');
    const songs = await promisifyRequest(store.index('playlistId').getAll(playlistId));
    songs.forEach(({ id }) => store.delete(id));
};
