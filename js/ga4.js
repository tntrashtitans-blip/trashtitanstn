/* Trash Titans GA4.
   Measurement ID: G-8R2NDF1M2K
   Set GA4_ID to '' to turn the tag off. The library loads only when an ID is set.
   Events: generate_lead (quote form submit), click_to_call (tel: links),
   thank_you_page_view (on /thanks and /thank-you). */
const GA4_ID = 'G-8R2NDF1M2K';

(function () {
  if (!GA4_ID) return;

  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
  document.head.appendChild(loader);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID);

  var path = (location.pathname || '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (path === '/thanks' || path === '/thank-you') {
    gtag('event', 'thank_you_page_view', {
      page_path: location.pathname,
      page_location: location.href,
      page_title: document.title
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var link = el.closest('a[href^="tel:"]');
    if (!link) return;
    gtag('event', 'click_to_call', {
      link_url: link.getAttribute('href'),
      transport_type: 'beacon'
    });
  });

  // Wait briefly so the hit can leave, then perform a normal submit.
  // form.submit() does not re-fire this listener, and Netlify still receives the POST.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.nodeName !== 'FORM') return;
    if (form.getAttribute('data-ga-lead') === 'done') return;
    var name = form.getAttribute('name') || '';
    if (name.indexOf('quote') !== 0) return;
    e.preventDefault();
    form.setAttribute('data-ga-lead', 'done');
    var finished = false;
    function go() {
      if (finished) return;
      finished = true;
      form.submit();
    }
    gtag('event', 'generate_lead', {
      form_name: name,
      transport_type: 'beacon',
      event_callback: go,
      event_timeout: 800
    });
    setTimeout(go, 1000);
  });
})();
