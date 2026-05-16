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


// ---- Hero parallax ----
// Translate the hero background slower than the foreground scroll for a
// classic parallax effect. Skips when the user prefers reduced motion.
(function () {
  const heroBg = document.querySelector('.hero-bg');
  const heroEl = document.getElementById('home');
  if (!heroBg || !heroEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SPEED = 0.25;
  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY;
    // Skip work once the hero is well out of view.
    if (y > heroEl.offsetHeight + 200) return;
    heroBg.style.transform = 'translate3d(0,' + (y * SPEED) + 'px,0)';
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
})();


// ---- Mobile hamburger menu ----
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

function setMenu(open) {
  hamburger.classList.toggle('active', open);
  navLinks.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.style.overflow = open ? 'hidden' : '';
}

hamburger.addEventListener('click', () => {
  setMenu(!navLinks.classList.contains('open'));
});

// Close menu when a nav link is clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => setMenu(false));
});

// Close menu on outside click
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target) && navLinks.classList.contains('open')) {
    setMenu(false);
  }
});

// Close menu with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navLinks.classList.contains('open')) {
    setMenu(false);
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


// ---- Floating CTA visibility ----
// Hidden when: (a) hero in view, (b) contact section in view (form already there),
// or (c) user has dismissed it this session.
const floatingCta = document.getElementById('floatingCta');
const floatingCtaClose = document.getElementById('floatingCtaClose');
const hero = document.getElementById('home');
const contactSection = document.getElementById('contact');
const FLOATING_CTA_DISMISS_KEY = 'floatingCtaDismissed';

let heroVisible = true;
let contactVisible = false;
let ctaDismissed = false;
try { ctaDismissed = sessionStorage.getItem(FLOATING_CTA_DISMISS_KEY) === '1'; } catch (_) {}

function updateFloatingCta() {
  if (!floatingCta) return;
  const shouldHide = ctaDismissed || heroVisible || contactVisible;
  floatingCta.classList.toggle('floating-cta--hidden', shouldHide);
}

if (floatingCta && hero) {
  const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { heroVisible = entry.isIntersecting; });
    updateFloatingCta();
  }, { threshold: 0.3 });
  heroObserver.observe(hero);
}

if (floatingCta && contactSection) {
  const contactObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { contactVisible = entry.isIntersecting; });
    updateFloatingCta();
  }, { threshold: 0.15 });
  contactObserver.observe(contactSection);
}

if (floatingCtaClose) {
  floatingCtaClose.addEventListener('click', () => {
    ctaDismissed = true;
    try { sessionStorage.setItem(FLOATING_CTA_DISMISS_KEY, '1'); } catch (_) {}
    floatingCta.classList.add('floating-cta--dismissed');
  });
}

updateFloatingCta();


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
  if (field) {
    field.classList.toggle('error', !!message);
    field.setAttribute('aria-invalid', !!message ? 'true' : 'false');
    if (error) {
      error.setAttribute('role', 'alert');
      error.setAttribute('aria-live', 'polite');
      field.setAttribute('aria-describedby', fieldId + 'Error');
    }
  }
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

    // Replace the form with the success state so it's unmissable
    quoteForm.querySelectorAll(':scope > *:not(#formSuccess)').forEach(el => {
      el.classList.add('hidden');
    });
    formSuccess.classList.remove('hidden');
    // Scroll the success message into view and move focus for screen readers
    requestAnimationFrame(() => {
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { formSuccess.focus({ preventScroll: true }); } catch (_) {}
    });
    trackEvent('quote_form_submit', {
      event_category: 'lead',
      event_label: document.getElementById('service')?.value || '',
    });

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


// ---- Google Analytics / GTM Event Tracking ----
function trackEvent(eventName, params) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(Object.assign({ event: eventName }, params));
}

// Phone call clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="tel:"]');
  if (link) {
    trackEvent('phone_call', {
      event_category: 'contact',
      event_label: link.href.replace('tel:', ''),
    });
  }
});

// SMS clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="sms:"]');
  if (link) {
    trackEvent('sms_click', {
      event_category: 'contact',
      event_label: link.href.replace('sms:', ''),
    });
  }
});

// Get Quote button / CTA clicks
document.addEventListener('click', (e) => {
  const btn = e.target.closest(
    'a[href*="contact"], a[href*="#quote"], .floating-btn--quote, .nav-cta'
  );
  if (btn && !btn.href?.startsWith('tel:') && !btn.href?.startsWith('sms:')) {
    trackEvent('get_quote_click', {
      event_category: 'lead',
      event_label: btn.textContent.trim().slice(0, 50),
    });
  }
});



// ---- Floating draggable Call button ----
(function () {
  const PHONE = '+16198414193';
  const STORAGE_KEY = 'callFabPos';
  const DRAG_THRESHOLD = 6; // pixels before a press becomes a drag

  function init() {
    if (document.querySelector('.call-fab')) return;

    const btn = document.createElement('a');
    btn.href = 'tel:' + PHONE;
    btn.className = 'call-fab';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Call San Diego Hauling & Demo');
    btn.title = 'Call us — drag to move';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z"/></svg>';
    document.body.appendChild(btn);

    // Restore saved position (clamped to current viewport)
    applySavedPosition(btn);
    window.addEventListener('resize', () => applySavedPosition(btn), { passive: true });

    let startX = 0, startY = 0;
    let originLeft = 0, originTop = 0;
    let pointerId = null;
    let dragging = false;
    let moved = false;

    btn.addEventListener('pointerdown', (e) => {
      // Ignore right/middle clicks
      if (e.button !== undefined && e.button !== 0) return;
      pointerId = e.pointerId;
      moved = false;
      dragging = false;
      const rect = btn.getBoundingClientRect();
      // Switch to top/left positioning so we can move freely
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.left = rect.left + 'px';
      btn.style.top = rect.top + 'px';
      originLeft = rect.left;
      originTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      btn.setPointerCapture(pointerId);
    });

    btn.addEventListener('pointermove', (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragging = true;
        moved = true;
        btn.classList.add('dragging');
      }
      if (dragging) {
        e.preventDefault();
        const w = btn.offsetWidth;
        const h = btn.offsetHeight;
        const maxLeft = window.innerWidth - w - 4;
        const maxTop = window.innerHeight - h - 4;
        const left = Math.min(Math.max(originLeft + dx, 4), maxLeft);
        const top = Math.min(Math.max(originTop + dy, 4), maxTop);
        btn.style.left = left + 'px';
        btn.style.top = top + 'px';
      }
    });

    function endDrag(e) {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      try { btn.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      if (dragging) {
        btn.classList.remove('dragging');
        savePosition(btn);
      }
      dragging = false;
    }

    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', endDrag);

    // Suppress the click (navigation to tel:) if the user was dragging
    btn.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    });

    // Prevent the iOS context menu / image-save on long press
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function savePosition(btn) {
    try {
      const rect = btn.getBoundingClientRect();
      // Store as fractions of viewport so it survives resizes/orientation changes
      const data = {
        xRatio: rect.left / window.innerWidth,
        yRatio: rect.top / window.innerHeight,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function applySavedPosition(btn) {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    if (!data || typeof data.xRatio !== 'number' || typeof data.yRatio !== 'number') return;
    const w = btn.offsetWidth || 60;
    const h = btn.offsetHeight || 60;
    const left = Math.min(Math.max(data.xRatio * window.innerWidth, 4), window.innerWidth - w - 4);
    const top = Math.min(Math.max(data.yRatio * window.innerHeight, 4), window.innerHeight - h - 4);
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
