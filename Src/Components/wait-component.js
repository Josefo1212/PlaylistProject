let _overlay = null;

function createOverlay() {
  if (_overlay) return _overlay;

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-vinyl">
      <div class="loading-vinyl__disc">
        <div class="loading-vinyl__rings">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="loading-vinyl__reflection"></div>
        <div class="loading-vinyl__label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
      </div>
    </div>
    <span class="loading-vinyl__text">Cargando...</span>
  `;
  document.body.appendChild(overlay);
  _overlay = overlay;
  return _overlay;
}

export function showWait(text) {
  const overlay = createOverlay();
  if (text) overlay.querySelector('.loading-vinyl__text').textContent = text;
  requestAnimationFrame(() => overlay.classList.add('loading-overlay--visible'));
}

export function hideWait() {
  if (!_overlay) return;
  _overlay.classList.remove('loading-overlay--visible');
  setTimeout(() => {
    if (_overlay && _overlay.parentNode) {
      _overlay.parentNode.removeChild(_overlay);
    }
    _overlay = null;
  }, 500);
}

window.showWait = showWait;
window.hideWait = hideWait;
