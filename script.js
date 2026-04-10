/* ============================================
   HAULAWAYPRO — MAIN SCRIPT
   ============================================ */

'use strict';

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });


// ---- Mobile hamburger menu ----
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
  document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
});

// Close menu when a nav link is clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// Close menu on outside click
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target) && navLinks.classList.contains('open')) {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  }
});


// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const navHeight = navbar.offsetHeight;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: targetPos, behavior: 'smooth' });
    }
  });
});


// ---- Scroll-triggered fade-in animations ----
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -48px 0px',
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Animate cards, steps, reviews, etc.
const animatableSelectors = [
  '.service-card',
  '.step',
  '.pricing-card',
  '.review-card',
  '.guarantee-item',
  '.area-tags span',
  '.contact-item',
  '.section-header',
];

animatableSelectors.forEach(selector => {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add('fade-in');
    el.style.transitionDelay = `${i * 60}ms`;
    observer.observe(el);
  });
});


// ---- Floating CTA visibility (show after scrolling past hero) ----
const floatingCta = document.getElementById('floatingCta');
const hero = document.getElementById('home');

const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    // Hide floating CTA when hero is visible
    if (entry.isIntersecting) {
      floatingCta.style.transform = 'translateY(100%)';
      floatingCta.style.opacity = '0';
    } else {
      floatingCta.style.transform = 'translateY(0)';
      floatingCta.style.opacity = '1';
    }
  });
}, { threshold: 0.3 });

floatingCta.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
floatingCta.style.transform = 'translateY(100%)';
floatingCta.style.opacity = '0';
heroObserver.observe(hero);


// ---- Quote form validation & submission ----
const quoteForm = document.getElementById('quoteForm');
const formSuccess = document.getElementById('formSuccess');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoading = document.getElementById('btnLoading');

const validators = {
  name: (val) => {
    if (!val.trim()) return 'Please enter your full name.';
    if (val.trim().length < 2) return 'Name must be at least 2 characters.';
    return '';
  },
  phone: (val) => {
    const digits = val.replace(/\D/g, '');
    if (!val.trim()) return 'Please enter your phone number.';
    if (digits.length < 10) return 'Please enter a valid 10-digit phone number.';
    return '';
  },
  email: (val) => {
    if (!val.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address.';
    return '';
  },
  zip: (val) => {
    if (!val.trim()) return 'Please enter your zip code.';
    if (!/^\d{5}$/.test(val)) return 'Please enter a valid 5-digit zip code.';
    return '';
  },
  service: (val) => {
    if (!val) return 'Please select a service type.';
    return '';
  },
};

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + 'Error');
  if (field) field.classList.toggle('error', !!message);
  if (error) error.textContent = message;
}

function clearError(fieldId) {
  showError(fieldId, '');
}

// Real-time validation on blur
['name', 'phone', 'email', 'zip', 'service'].forEach(fieldId => {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.addEventListener('blur', () => {
    const error = validators[fieldId](field.value);
    showError(fieldId, error);
  });

  field.addEventListener('input', () => {
    if (field.classList.contains('error')) {
      const error = validators[fieldId](field.value);
      showError(fieldId, error);
    }
  });
});

// Phone auto-format
const phoneInput = document.getElementById('phone');
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 7) {
      val = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6,10)}`;
    } else if (val.length >= 4) {
      val = `(${val.slice(0,3)}) ${val.slice(3)}`;
    } else if (val.length >= 1) {
      val = `(${val}`;
    }
    e.target.value = val;
  });
}

// Zip: digits only
const zipInput = document.getElementById('zip');
if (zipInput) {
  zipInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
  });
}

// ---- File upload / drag-and-drop ----
const fileDropZone  = document.getElementById('fileDropZone');
const fileInput     = document.getElementById('photos');
const previewList   = document.getElementById('filePreviewList');
const MAX_FILES     = 5;
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB
let selectedFiles   = [];

function renderPreviews() {
  previewList.innerHTML = '';
  selectedFiles.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'file-preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const btn = document.createElement('button');
    btn.className = 'file-preview-remove';
    btn.type = 'button';
    btn.textContent = '✕';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFiles.splice(idx, 1);
      renderPreviews();
    });

    item.appendChild(img);
    item.appendChild(btn);
    previewList.appendChild(item);
  });

  if (selectedFiles.length > 0) {
    const label = document.createElement('span');
    label.className = 'file-count-label';
    label.style.width = '100%';
    label.textContent = `${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''} selected`;
    previewList.appendChild(label);
  }
}

function addFiles(files) {
  for (const file of files) {
    if (selectedFiles.length >= MAX_FILES) {
      alert(`Maximum ${MAX_FILES} photos allowed.`);
      break;
    }
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_BYTES) {
      alert(`"${file.name}" exceeds 10MB and was skipped.`);
      continue;
    }
    selectedFiles.push(file);
  }
  renderPreviews();
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });
}

if (fileDropZone) {
  fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.classList.add('dragover');
  });

  fileDropZone.addEventListener('dragleave', () => {
    fileDropZone.classList.remove('dragover');
  });

  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files));
  });
}

// Set min date for date picker to today
const dateInput = document.getElementById('date');
if (dateInput) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
}

// Form submit
if (quoteForm) quoteForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validate all fields
  const fields = ['name', 'phone', 'email', 'zip', 'service'];
  let isValid = true;

  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    const error = validators[fieldId](field.value);
    showError(fieldId, error);
    if (error) isValid = false;
  });

  if (!isValid) {
    // Scroll to first error
    const firstError = quoteForm.querySelector('.error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError.focus();
    }
    return;
  }

  submitBtn.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  // Collect form data (multipart so photos can be attached)
  const sizeEl = quoteForm.querySelector('input[name="size"]:checked');
  const formData = new FormData();
  formData.append('name',    document.getElementById('name').value.trim());
  formData.append('phone',   document.getElementById('phone').value.trim());
  formData.append('email',   document.getElementById('email').value.trim());
  formData.append('zip',     document.getElementById('zip').value.trim());
  formData.append('service', document.getElementById('service').value);
  formData.append('size',    sizeEl ? sizeEl.value : 'not specified');
  formData.append('message', document.getElementById('message').value.trim());
  formData.append('date',    document.getElementById('date').value || 'not specified');
  selectedFiles.forEach((file) => formData.append('photos', file));

  try {
    const FORMSPREE_ID = 'mkoperpg';
    const endpoint = `https://formspree.io/f/${FORMSPREE_ID}`;

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Accept': 'application/json' }, // no Content-Type — browser sets multipart boundary
      body:    formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Submission failed');
    }

    formSuccess.classList.remove('hidden');

  } catch (err) {
    submitBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
    alert('Something went wrong. Please try again or call us at (619) 841-4193.');
    console.error('Form error:', err);
  }
});


// ---- Lightbox ----
function openLightbox(src, caption) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = caption;
  document.getElementById('lightboxCaption').textContent = caption;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});


// ---- Back to Top ----
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  backToTop.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});


// ---- 3D Card Tilt Effect ----
const MAX_TILT = 8; // max degrees of rotation

function applyTilt(selector, baseCssTransform) {
  document.querySelectorAll(selector).forEach(card => {
    let rafId;

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'box-shadow 0.15s ease';
    });

    card.addEventListener('mousemove', (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = (((y - cy) / cy) * -MAX_TILT).toFixed(2);
        const rotY = (((x - cx) / cx) *  MAX_TILT).toFixed(2);
        const shadowX = (rotY * 2.5).toFixed(0);
        const shadowY = (-rotX * 2.5).toFixed(0);
        card.style.transform = `${baseCssTransform}perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(10px)`;
        card.style.boxShadow = `${shadowX}px ${shadowY}px 40px rgba(0,0,0,.2)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(rafId);
      card.style.transition = 'transform 0.6s cubic-bezier(.03,.98,.52,.99), box-shadow 0.6s ease';
      card.style.transform = baseCssTransform.trim() || '';
      card.style.boxShadow = '';
    });
  });
}

// Only apply on devices that support hover (not touch-only)
if (window.matchMedia('(hover: hover)').matches) {
  applyTilt('.service-card', '');
  applyTilt('.review-card', '');
  applyTilt('.pricing-card:not(.pricing-card--featured)', '');
  applyTilt('.pricing-card--featured', 'scale(1.05) ');
}


// ---- Active nav link on scroll ----
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(section => sectionObserver.observe(section));

// Add active nav link style
const style = document.createElement('style');
style.textContent = `.nav-links a.active { color: var(--color-primary) !important; }`;
document.head.appendChild(style);
