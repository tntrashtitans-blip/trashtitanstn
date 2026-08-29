(function () {
  var REVIEWS_URL =
    'https://www.google.com/maps/place/Trash+Titans/@35.9277969,-86.2991721,17z/data=!4m6!3m5!1s0x65543b4ffe424819:0xf04d58c0cd2ab83d!16s%2Fg%2F11z304_ydp#lrd=0x65543b4ffe424819:0xf04d58c0cd2ab83d,1';

  function $(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function hide(el) {
    if (el) el.setAttribute('hidden', '');
  }

  function show(el) {
    if (el) el.removeAttribute('hidden');
  }

  function setText(sel, text) {
    $(sel).forEach(function (el) {
      el.textContent = text;
    });
  }

  function hideNumericPlaceholders() {
    $('[data-google-stat]').forEach(hide);
    $('[data-google-live]').forEach(hide);
    $('[data-google-fallback]').forEach(show);
  }

  function showLive() {
    $('[data-google-stat]').forEach(show);
    $('[data-google-live]').forEach(show);
    $('[data-google-fallback]').forEach(hide);
  }

  function updateJsonLd(rating, count) {
    var scripts = $('script[type="application/ld+json"]');
    scripts.forEach(function (script) {
      var data;
      try {
        data = JSON.parse(script.textContent);
      } catch (e) {
        return;
      }
      var nodes = Array.isArray(data) ? data : [data];
      var changed = false;
      nodes.forEach(function (node) {
        if (!node || typeof node !== 'object') return;
        var type = node['@type'];
        if (type !== 'HomeAndConstructionBusiness' && type !== 'LocalBusiness') return;
        node.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: String(rating),
          bestRating: '5',
          reviewCount: String(count)
        };
        changed = true;
      });
      if (changed) {
        script.textContent = JSON.stringify(Array.isArray(data) ? nodes : nodes[0]);
      }
    });
  }

  $('[data-google-reviews-link]').forEach(function (a) {
    a.setAttribute('href', REVIEWS_URL);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  hideNumericPlaceholders();

  fetch('/.netlify/functions/google-place', { credentials: 'same-origin' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.ok) {
        hideNumericPlaceholders();
        return;
      }
      var rating = Number(data.rating);
      var count = Number(data.userRatingCount);
      if (!isFinite(rating) || rating <= 0 || !isFinite(count) || count <= 0) {
        hideNumericPlaceholders();
        return;
      }
      var ratingText = rating.toFixed(1);
      var countText = String(Math.round(count));
      setText('[data-google-rating]', ratingText);
      setText('[data-google-count]', countText);
      showLive();
      updateJsonLd(ratingText, countText);
    })
    .catch(function () {
      hideNumericPlaceholders();
    });
})();
