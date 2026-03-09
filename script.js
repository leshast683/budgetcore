// Budgetly — main script

document.addEventListener('DOMContentLoaded', () => {
  const heroBtn = document.querySelector('.hero .btn');
  const featuresSection = document.getElementById('features');

  if (heroBtn && featuresSection) {
    heroBtn.addEventListener('click', (e) => {
      e.preventDefault();
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
