// ================================================
// VISTA GROWTH AGENCY — Main Script
// Enhanced with Emil Kowalski + Taste + Impeccable design principles
// ================================================

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('active');
  hamburger.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
    hamburger.classList.remove('active');
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Animated counter for hero stats
function animateCounters() {
  const counters = document.querySelectorAll('.stat-number');
  counters.forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;

    const update = () => {
      current += step;
      if (current < target) {
        counter.textContent = Math.floor(current);
        requestAnimationFrame(update);
      } else {
        counter.textContent = target;
      }
    };

    update();
  });
}

// ================================================
// Intersection Observer — Emil: scale(0.97)+opacity entrance
// with stagger timing set via CSS nth-child
// ================================================
const observerOptions = {
  threshold: 0.05,
  rootMargin: '0px 0px -80px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Add fade-in class to all animatable elements
const animatableSelectors = [
  '.service-card',
  '.process-step',
  '.pricing-card',
  '.testimonial-card',
  '.info-card',
  '.about-feature',
  '.industry-card',
  '.comparison-row',
  '.faq-item',
  '.badge-item',
  '.case-study-card',
  '.about-card'
];

document.querySelectorAll(animatableSelectors.join(', ')).forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// Section headers also fade in
document.querySelectorAll('.section-header').forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// Trigger counter animation when hero is visible
const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounters();
      heroObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) heroObserver.observe(heroStats);

// Contact form handler
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value || 'Not provided';
    const business = document.getElementById('business').value || 'Not provided';
    const service = document.getElementById('service').value || 'Not specified';
    const budget = document.getElementById('budget').value || 'Not specified';
    const message = document.getElementById('message').value || 'No message';

    // Build WhatsApp message
    const waMessage = `🔥 NEW LEAD — Vista Growth Agency\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `Business: ${business}\n` +
      `Service: ${service}\n` +
      `Budget: ${budget}\n` +
      `Message: ${message}`;

    // Show success message
    document.getElementById('successMsg').style.display = 'block';

    // Open WhatsApp after delay
    setTimeout(() => {
      window.open(`https://wa.me/16028217262?text=${encodeURIComponent(waMessage)}`, '_blank');
    }, 1000);

    // Reset form after delay
    setTimeout(() => {
      contactForm.reset();
      document.getElementById('successMsg').style.display = 'none';
    }, 5000);
  });
}

// Parallax effect on hero (subtle, respects reduced motion)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  window.addEventListener('scroll', () => {
    const hero = document.getElementById('hero');
    if (hero) {
      const scrolled = window.scrollY;
      const heroContent = hero.querySelector('.hero-content');
      if (heroContent && scrolled < window.innerHeight) {
        heroContent.style.transform = `translateY(${scrolled * 0.12}px)`;
        heroContent.style.opacity = 1 - (scrolled / (window.innerHeight * 0.8));
      }
    }
  }, { passive: true });
}

// FAQ toggle
function toggleFaq(btn) {
  const item = btn.parentElement;
  const isActive = item.classList.contains('active');

  // Close all
  document.querySelectorAll('.faq-item').forEach(faq => {
    faq.classList.remove('active');
  });

  // Open clicked (if it wasn't already open)
  if (!isActive) {
    item.classList.add('active');
  }
}

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 100;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);
    if (link) {
      if (scrollY >= top && scrollY < top + height) {
        link.style.color = '#D4AF37';
      } else {
        link.style.color = '';
      }
    }
  });
}, { passive: true });

// ================================================
// Reduced motion: disable hero stagger animations
// ================================================
if (prefersReducedMotion) {
  document.querySelectorAll('.hero-content > *').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.animation = 'none';
  });
}
