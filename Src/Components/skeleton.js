function bone(cls) {
  const el = document.createElement('div');
  el.className = `skel ${cls || ''}`;
  return el;
}

function songCardSkeleton() {
  const card = bone('skel-card');
  card.innerHTML = `
    <div class="skel-card__cover"></div>
    <div class="skel-card__body">
      <div class="skel-card__title"></div>
      <div class="skel-card__artist"></div>
    </div>`;
  return card;
}

function heroSkeleton() {
  const el = bone('skel-hero');
  el.innerHTML = `
    <div class="skel-hero__cover"></div>
    <div class="skel-hero__text">
      <div class="skel-hero__label"></div>
      <div class="skel-hero__title"></div>
      <div class="skel-hero__artist"></div>
      <div class="skel-hero__actions">
        <div class="skel-hero__btn"></div>
        <div class="skel-hero__btn skel-hero__btn--sm"></div>
      </div>
    </div>`;
  return el;
}

function carouselSkeleton(count) {
  const wrap = bone('skel-carousel');
  for (let i = 0; i < (count || 5); i++) wrap.appendChild(songCardSkeleton());
  return wrap;
}

function gridSkeleton(count) {
  const grid = bone('skel-grid');
  for (let i = 0; i < (count || 10); i++) grid.appendChild(songCardSkeleton());
  return grid;
}

function showHomeSkeleton() {
  const home = document.getElementById('section-home');
  if (!home) return;
  const existing = home.querySelector('.skel-wrap');
  if (existing) return;

  const wrap = bone('skel-wrap');
  wrap.appendChild(heroSkeleton());
  const recentBlock = bone('skel-section');
  recentBlock.appendChild(carouselSkeleton(5));
  wrap.appendChild(recentBlock);
  const recBlock = bone('skel-section');
  recBlock.appendChild(gridSkeleton(10));
  wrap.appendChild(recBlock);

  const header = home.querySelector('.section__header');
  if (header && header.nextSibling) {
    home.insertBefore(wrap, header.nextSibling);
  } else {
    home.appendChild(wrap);
  }

  home.querySelectorAll('.hero, .section__block').forEach(el => el.style.display = 'none');
}

function hideHomeSkeleton() {
  const home = document.getElementById('section-home');
  if (!home) return;
  const wrap = home.querySelector('.skel-wrap');
  if (wrap) wrap.remove();
  home.querySelectorAll('.hero, .section__block').forEach(el => el.style.display = '');
}

function showGridSkeleton(containerId, count) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (container.querySelector('.skel-grid')) return;
  const skeleton = gridSkeleton(count || 12);
  container.appendChild(skeleton);
}

function hideGridSkeleton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const skel = container.querySelector('.skel-grid');
  if (skel) skel.remove();
}

function showExploreSkeleton() {
  showGridSkeleton('exploreGrid', 12);
}

function hideExploreSkeleton() {
  hideGridSkeleton('exploreGrid');
}

function showLibrarySkeleton() {
  showGridSkeleton('libraryGrid', 10);
}

function hideLibrarySkeleton() {
  hideGridSkeleton('libraryGrid');
}

function showFavoritesSkeleton() {
  showGridSkeleton('favoritesGrid', 6);
}

function hideFavoritesSkeleton() {
  hideGridSkeleton('favoritesGrid');
}

window.Skeleton = {
  showHome: showHomeSkeleton,
  hideHome: hideHomeSkeleton,
  showExplore: showExploreSkeleton,
  hideExplore: hideExploreSkeleton,
  showLibrary: showLibrarySkeleton,
  hideLibrary: hideLibrarySkeleton,
  showFavorites: showFavoritesSkeleton,
  hideFavorites: hideFavoritesSkeleton,
};
