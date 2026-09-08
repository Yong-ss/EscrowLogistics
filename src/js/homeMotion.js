// Keep motion on the public page independent of wallet and truck loading.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.home-header');
  const items = Array.from(document.querySelectorAll(
    '.home-header .brand, .home-header nav, .home-header [data-connect], ' +
    '.home-intro > :not(.home-actions), .home-actions > *, .truck-stage, ' +
    '.journey-caption > *, .journey-track, .home-section .section-heading > *, ' +
    '.action-card, .home-steps li, .home-cta > div > *, .home-cta > .button, .home-footer > *'
  ));
  const animations = new Map();
  let destinationSection = null;
  const enter = (element, delay = 0) => {
    animations.get(element)?.cancel();
    if (reduced.matches || !element.animate) return;
    const animation = element.animate([
      { opacity: 0, translate: '0 24px' },
      { opacity: 1, translate: '0 0' }
    ], { duration: 760, delay, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
    animations.set(element, animation);
    animation.onfinish = () => animations.delete(element);
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      visible.forEach((entry, index) => {
        if (!destinationSection?.contains(entry.target)) enter(entry.target, Math.min(index * 65, 260));
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    items.forEach((element) => observer.observe(element));
  }

  let frame = 0;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; destinationSection = null; };
  // A wheel, touch, or navigation key immediately returns control to the visitor.
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape', 'Tab', ' '].includes(event.key)) stop();
  });
  window.addEventListener('popstate', stop);
  window.addEventListener('resize', stop);
  reduced.addEventListener('change', () => {
    stop();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target || link.classList.contains('home-skip')) return;
      event.preventDefault();
      stop();
      destinationSection = target;
      const from = window.scrollY;
      const top = target.id === 'home-title' ? 0 : from + target.getBoundingClientRect().top - header.offsetHeight - 20;
      const destination = Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
      const finish = () => {
        frame = 0;
        destinationSection = null;
        if (window.location.hash !== link.hash) history.pushState(null, '', link.hash);
        const hadTabindex = target.hasAttribute('tabindex');
        if (!hadTabindex) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        // Replay only visible destination content; lower content enters on scroll.
        items.filter((element) => target.contains(element) && element.getBoundingClientRect().top < window.innerHeight)
          .forEach((element, index) => enter(element, Math.min(index * 65, 260)));
        document.querySelectorAll('.home-header nav a').forEach((navLink) => {
          if (navLink.hash === link.hash) navLink.setAttribute('aria-current', 'location');
          else navLink.removeAttribute('aria-current');
        });
      };
      if (reduced.matches || Math.abs(destination - from) < 2) {
        window.scrollTo(0, destination);
        finish();
        return;
      }
      const duration = Math.min(1450, 650 + Math.abs(destination - from) * .22);
      const started = performance.now();
      const move = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const ease = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo(0, from + (destination - from) * ease);
        if (progress < 1) frame = requestAnimationFrame(move);
        else finish();
      };
      frame = requestAnimationFrame(move);
    });
  });
})();
