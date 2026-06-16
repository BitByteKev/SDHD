(function () {
  var el = document.getElementById('google-reviews');
  if (!el) return;

  var workerUrl = el.getAttribute('data-worker');
  var googleUrl = 'http://google.com/localservices/review/sandiego619';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function stars(n) {
    var full = Math.round(n || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="gr-star' + (i <= full ? ' gr-star-on' : '') + '">★</span>';
    }
    return out;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function fallback() {
    el.innerHTML =
      '<div class="gr-fallback"><a class="btn btn-primary btn-lg" target="_blank" ' +
      'rel="noopener" href="' + googleUrl + '">★ See our reviews on Google</a></div>';
  }

  if (!workerUrl) { fallback(); return; }

  fetch(workerUrl)
    .then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); })
    .then(function (data) {
      if (!data || !data.reviews || !data.reviews.length) { fallback(); return; }
      var maps = data.mapsUri || googleUrl;

      var header =
        '<div class="gr-header">' +
        '<span class="gr-avg">' + (data.rating || 0).toFixed(1) + '</span>' +
        '<span class="gr-stars">' + stars(data.rating) + '</span>' +
        '<a class="gr-count" href="' + escapeHtml(maps) + '" target="_blank" ' +
        'rel="noopener">' + (data.total || 0) + ' Google reviews →</a>' +
        '</div>';

      var cards = data.reviews.map(function (rev, i) {
        return '<article class="review-card gr-card" style="animation-delay:' +
          (i * 0.08) + 's">' +
          '<div class="gr-card-top">' +
          '<span class="gr-avatar">' + escapeHtml(rev.initials || '?') + '</span>' +
          '<div class="gr-meta">' +
          '<span class="gr-name">' + escapeHtml(rev.name) + '</span>' +
          '<span class="gr-stars gr-stars-sm">' + stars(rev.rating) + '</span>' +
          '</div>' +
          '<span class="gr-g" title="Google review">G</span>' +
          '</div>' +
          '<p class="gr-text">' + escapeHtml(rev.text) + '</p>' +
          '<span class="gr-date">' + escapeHtml(fmtDate(rev.time)) + '</span>' +
          '</article>';
      }).join('');

      el.innerHTML = header + '<div class="gr-grid">' + cards + '</div>';
    })
    .catch(fallback);
})();
