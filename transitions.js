// Soft page transition — fade out before navigating, fade in on load
export function initPageTransitions() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript') ||
        href.startsWith('mailto') || link.target === '_blank') return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    document.body.classList.add('page-leaving');
    setTimeout(() => { window.location.href = href; }, 220);
  });
}
