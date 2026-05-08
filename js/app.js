// js/app.js — CafeSpot main application logic

(async () => {

  // ─── Load Google Maps JS API ──────────────────────────────────────────────
  function loadGoogleMapsScript() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) { resolve(); return; }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

  await loadGoogleMapsScript();
  UI.initMap();

  // ─── State ────────────────────────────────────────────────────────────────
  let currentCafes = [];
  let autocompleteTimer = null;

  // ─── Elements ─────────────────────────────────────────────────────────────
  const form       = document.getElementById('search-form');
  const input      = document.getElementById('suburb-input');
  const modalClose = document.getElementById('modal-close');
  const modalOverlay = document.getElementById('cafe-modal');

  // ─── Search Form ──────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const suburb = input.value.trim();
    if (!suburb) {
      UI.setValidationMsg('Please enter a suburb name.');
      return;
    }
    await runSearch(suburb);
  });

  async function runSearch(suburb) {
    UI.setValidationMsg('');
    UI.showLoading();
    UI.hideAutocomplete();
    UI.clearMapMarkers();

    try {
      // Step 1: Validate & Geocode
      const geo = await API.validateAndGeocode(suburb);

      if (!geo.valid) {
        UI.hideLoading();
        UI.setValidationMsg(geo.error || 'Could not find that suburb. Try another.');
        return;
      }

      UI.setValidationMsg(`Searching near ${geo.formatted_address}`, true);

      const { lat, lng, formatted_address } = geo;

      // Step 2: Pan map to suburb, draw radius
      UI.panToSuburb(lat, lng);
      UI.drawRadiusCircle(lat, lng, CONFIG.SEARCH_RADIUS_METERS);
      UI.addCenterMarker(lat, lng, formatted_address);

      // Step 3: Search cafes
      const cafesData = await API.searchCafes(lat, lng, CONFIG.SEARCH_RADIUS_METERS);
      const cafes = cafesData.cafes || [];

      if (cafes.length === 0) {
        UI.showEmpty();
        return;
      }

      // Step 4: Get distances (batch)
      const placeIds = cafes.map(c => c.place_id);
      let distancesMap = {};

      try {
        const distData = await API.getDistances(lat, lng, placeIds);
        (distData.distances || []).forEach(d => {
          distancesMap[d.place_id] = d;
        });
      } catch (distErr) {
        console.warn('Distance Matrix failed, using straight-line distances:', distErr);
      }

      // Step 5: Merge distance data into cafes, sort nearest → farthest
      const enriched = cafes.map(cafe => {
        const dist = distancesMap[cafe.place_id];
        return {
          ...cafe,
          distance_text:  dist ? dist.distance_text  : straightLineText(lat, lng, cafe.lat, cafe.lng),
          distance_value: dist ? dist.distance_value : straightLineMeters(lat, lng, cafe.lat, cafe.lng),
          duration_text:  dist ? dist.duration_text  : null,
        };
      }).sort((a, b) => a.distance_value - b.distance_value);

      currentCafes = enriched;

      // Step 6: Add map markers
      enriched.forEach((cafe, i) => {
        UI.addCafeMarker(cafe, i, (clickedIndex) => {
          UI.setActiveCard(clickedIndex);
          UI.openModal(currentCafes[clickedIndex]);
        });
      });

      // Step 7: Render cards
      UI.renderResults(enriched, formatted_address, (cafe, index) => {
        UI.openModal(cafe);
      });

      UI.setValidationMsg('');

    } catch (err) {
      console.error(err);
      UI.showError(err.message || 'Something went wrong. Please try again.');
      UI.setValidationMsg('');
    }
  }

  // ─── Autocomplete ─────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    clearTimeout(autocompleteTimer);
    const val = input.value.trim();
    if (val.length < 2) { UI.hideAutocomplete(); return; }
    autocompleteTimer = setTimeout(async () => {
      try {
        const predictions = await API.autocomplete(val);
        UI.renderAutocomplete(predictions, (selected) => {
          input.value = selected;
          UI.hideAutocomplete();
          runSearch(selected);
        });
      } catch (e) {
        UI.hideAutocomplete();
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) UI.hideAutocomplete();
  });

  // ─── Modal ────────────────────────────────────────────────────────────────
  modalClose.addEventListener('click', UI.closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) UI.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') UI.closeModal();
  });

  // ─── Distance Helpers (fallback straight-line) ────────────────────────────
  function straightLineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function straightLineText(lat1, lng1, lat2, lng2) {
    const m = straightLineMeters(lat1, lng1, lat2, lng2);
    return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`;
  }

})();
