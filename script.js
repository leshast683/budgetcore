// BudgetCore — landing page script

document.addEventListener('DOMContentLoaded', () => {
  // Sticky nav shadow on scroll
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }
});
