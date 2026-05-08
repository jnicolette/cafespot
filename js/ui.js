// js/ui.js — CafeSpot UI rendering

const UI = (() => {

  let map = null;
  let markers = [];
  let radiusCircle = null;
  let activeCardIndex = null;

  // ─── Map ─────────────────────────────────────────────────────────────────

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: CONFIG.DEFAULT_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      disableDefaultUI: false,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#f5ebe0' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#4a2c1a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#fdfaf6' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8d5c0' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d9c4a8' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#aecbcb' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d7a7a' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8dfc0' }] },
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });
  }

  function clearMapMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
    if (radiusCircle) { radiusCircle.setMap(null); radiusCircle = null; }
  }

  function drawRadiusCircle(lat, lng, radius) {
    radiusCircle = new google.maps.Circle({
      map,
      center: { lat, lng },
      radius,
      fillColor: '#C07941',
      fillOpacity: 0.06,
      strokeColor: '#C07941',
      strokeOpacity: 0.35,
      strokeWeight: 1.5,
    });
  }

  function addCenterMarker(lat, lng, label) {
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: label,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#C07941',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      zIndex: 999,
    });
    markers.push(marker);
  }

  function addCafeMarker(cafe, index, onClickCb) {
    const marker = new google.maps.Marker({
      position: { lat: cafe.lat, lng: cafe.lng },
      map,
      title: cafe.name,
      label: {
        text: String(index + 1),
        color: '#fff',
        fontSize: '11px',
        fontWeight: '600',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#4A2C1A',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      zIndex: 10,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family:'DM Sans',sans-serif;padding:4px 6px;min-width:140px">
          <strong style="font-family:'Playfair Display',serif;font-size:13px;color:#2C1A0E">${cafe.name}</strong><br/>
          <span style="font-size:11px;color:#7A6654">${cafe.distance_text || ''}</span>
        </div>
      `,
    });

    marker.addListener('click', () => {
      onClickCb(index);
      infoWindow.open(map, marker);
    });

    markers.push(marker);
    return marker;
  }

  function highlightMarker(index) {
    markers.forEach((m, i) => {
      if (!m.getLabel) return;
      const label = m.getLabel();
      if (!label) return;
      const isActive = (i - 1) === index; // offset by center marker
      m.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: isActive ? 16 : 14,
        fillColor: isActive ? '#C07941' : '#4A2C1A',
        fillOpacity: isActive ? 1 : 0.9,
        strokeColor: '#fff',
        strokeWeight: isActive ? 3 : 2,
      });
    });
  }

  function panToSuburb(lat, lng) {
    map.panTo({ lat, lng });
    map.setZoom(CONFIG.RESULTS_ZOOM);
    document.getElementById('map-placeholder').classList.add('hidden');
  }

  // ─── Loader / States ──────────────────────────────────────────────────────

  function showLoading() {
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('results-header').classList.add('hidden');
    document.getElementById('results-grid').innerHTML = '';
    document.getElementById('search-btn').disabled = true;
  }

  function hideLoading() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('search-btn').disabled = false;
  }

  function showError(msg) {
    hideLoading();
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('error-msg').textContent = msg;
  }

  function showEmpty() {
    hideLoading();
    document.getElementById('empty-state').classList.remove('hidden');
  }

  function setValidationMsg(msg, isSuccess = false) {
    const el = document.getElementById('validation-msg');
    el.textContent = msg;
    el.className = 'validation-msg' + (isSuccess ? ' success' : '');
  }

  // ─── Cafe Cards ───────────────────────────────────────────────────────────

  function renderResults(cafes, suburbName, onCardClick) {
    hideLoading();

    if (!cafes || cafes.length === 0) { showEmpty(); return; }

    // Header
    document.getElementById('results-header').classList.remove('hidden');
    document.getElementById('suburb-name').textContent = suburbName;
    document.getElementById('results-count').textContent =
      `${cafes.length} cafe${cafes.length !== 1 ? 's' : ''} found within 5km`;

    // Grid
    const grid = document.getElementById('results-grid');
    grid.innerHTML = '';

    cafes.forEach((cafe, i) => {
      const card = buildCafeCard(cafe, i, onCardClick);
      card.style.animationDelay = `${i * 50}ms`;
      grid.appendChild(card);
    });
  }

  function buildCafeCard(cafe, index, onCardClick) {
    const card = document.createElement('div');
    card.className = 'cafe-card';
    card.dataset.index = index;

    const ratingStars = cafe.rating ? renderStars(cafe.rating) : null;
    const statusHtml = cafe.opening_hours != null
      ? `<span class="card-status ${cafe.opening_hours ? 'open' : 'closed'}">${cafe.opening_hours ? 'Open now' : 'Closed'}</span>`
      : '';

    const thumbHtml = cafe.photo_reference
      ? `<img class="card-thumb" src="${API.getPhotoUrl(cafe.photo_reference, 200)}" alt="${cafe.name}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="card-thumb-placeholder">☕</div>`;

    card.innerHTML = `
      <div class="card-main">
        <div class="card-name">${escapeHtml(cafe.name)}</div>
        <div class="card-address">${escapeHtml(cafe.vicinity || cafe.formatted_address || '')}</div>
        <div class="card-meta">
          <span class="card-distance">📍 ${cafe.distance_text || 'Distance N/A'}</span>
          ${ratingStars ? `<span class="card-rating"><span class="stars">${ratingStars}</span> ${cafe.rating} (${cafe.user_ratings_total || 0})</span>` : ''}
          ${statusHtml}
        </div>
      </div>
      ${thumbHtml}
      <div class="card-rank">#${index + 1}</div>
    `;

    card.addEventListener('click', () => {
      setActiveCard(index);
      onCardClick(cafe, index);
    });

    return card;
  }

  function setActiveCard(index) {
    document.querySelectorAll('.cafe-card').forEach((c, i) => {
      c.classList.toggle('active', i === index);
    });
    activeCardIndex = index;
    highlightMarker(index);

    // Scroll card into view
    const cards = document.querySelectorAll('.cafe-card');
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ─── Modal ────────────────────────────────────────────────────────────────

  function openModal(cafe) {
    const modal = document.getElementById('cafe-modal');
    const content = document.getElementById('modal-content');

    const photoHtml = cafe.photo_reference
      ? `<img class="modal-photo" src="${API.getPhotoUrl(cafe.photo_reference, 800)}" alt="${cafe.name}" onerror="this.outerHTML='<div class=\\'modal-photo-placeholder\\'>☕</div>'">`
      : `<div class="modal-photo-placeholder">☕</div>`;

    const ratingStars = cafe.rating ? renderStars(cafe.rating) : '';

    const hoursHtml = cafe.weekday_text && cafe.weekday_text.length
      ? `<div class="modal-hours">
           <div class="modal-hours-title">Opening Hours</div>
           <ul class="modal-hours-list">
             ${cafe.weekday_text.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
           </ul>
         </div>`
      : '';

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name)}&query_place_id=${cafe.place_id}`;

    content.innerHTML = `
      ${photoHtml}
      <div class="modal-body">
        <div class="modal-name">${escapeHtml(cafe.name)}</div>
        <div class="modal-address">${escapeHtml(cafe.vicinity || cafe.formatted_address || '')}</div>
        <div class="modal-details">
          <div class="modal-detail-item">
            <div class="modal-detail-label">Distance</div>
            <div class="modal-detail-value">📍 ${cafe.distance_text || 'N/A'}</div>
          </div>
          <div class="modal-detail-item">
            <div class="modal-detail-label">Drive Time</div>
            <div class="modal-detail-value">🚗 ${cafe.duration_text || 'N/A'}</div>
          </div>
          ${cafe.rating ? `
          <div class="modal-detail-item">
            <div class="modal-detail-label">Rating</div>
            <div class="modal-detail-value"><span style="color:#E8A020">${ratingStars}</span> ${cafe.rating}</div>
          </div>` : ''}
          ${cafe.price_level != null ? `
          <div class="modal-detail-item">
            <div class="modal-detail-label">Price</div>
            <div class="modal-detail-value">${'$'.repeat(cafe.price_level + 1)}</div>
          </div>` : ''}
          ${cafe.opening_hours != null ? `
          <div class="modal-detail-item">
            <div class="modal-detail-label">Status</div>
            <div class="modal-detail-value ${cafe.opening_hours ? 'open' : ''}" style="color:${cafe.opening_hours ? '#5a7a50' : '#c0392b'}">${cafe.opening_hours ? '✅ Open now' : '❌ Closed'}</div>
          </div>` : ''}
        </div>
        ${hoursHtml}
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="modal-directions-btn">
          🗺️ Get Directions
        </a>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('cafe-modal').classList.add('hidden');
  }

  // ─── Autocomplete Dropdown ────────────────────────────────────────────────

  function renderAutocomplete(predictions, onSelect) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (!predictions || predictions.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    dropdown.innerHTML = '';
    predictions.forEach(pred => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = pred.description;
      item.addEventListener('click', () => {
        onSelect(pred.description);
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.remove('hidden');
  }

  function hideAutocomplete() {
    document.getElementById('autocomplete-dropdown').classList.add('hidden');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let stars = '★'.repeat(full);
    if (half) stars += '½';
    return stars;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    initMap, clearMapMarkers, drawRadiusCircle, addCenterMarker, addCafeMarker,
    panToSuburb, highlightMarker, setActiveCard,
    showLoading, hideLoading, showError, showEmpty, setValidationMsg,
    renderResults, openModal, closeModal,
    renderAutocomplete, hideAutocomplete,
  };
})();
