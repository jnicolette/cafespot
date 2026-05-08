// js/api.js — CafeSpot API layer
// All sensitive calls are proxied through the Python backend

const API = (() => {

  /**
   * Validate & geocode a suburb name.
   * Returns { valid, lat, lng, formatted_address, error }
   */
  async function validateAndGeocode(suburb) {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suburb }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Geocoding failed');
    }
    return response.json();
  }

  /**
   * Search for cafes near a lat/lng within radius.
   * Returns array of place objects.
   */
  async function searchCafes(lat, lng, radius = CONFIG.SEARCH_RADIUS_METERS) {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/cafes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, radius }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Places search failed');
    }
    return response.json(); // { cafes: [...] }
  }

  /**
   * Get distances from origin to many destinations using Distance Matrix.
   * Returns array of distances in same order as place_ids.
   */
  async function getDistances(originLat, originLng, placeIds) {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/distances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin_lat: originLat, origin_lng: originLng, place_ids: placeIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Distance Matrix failed');
    }
    return response.json(); // { distances: [{ place_id, distance_text, distance_value, duration_text }] }
  }

  /**
   * Get place photo URL for a given photo reference.
   */
  function getPhotoUrl(photoReference, maxWidth = 400) {
    return `${CONFIG.BACKEND_URL}/api/photo?ref=${encodeURIComponent(photoReference)}&maxwidth=${maxWidth}`;
  }

  /**
   * Autocomplete suburb suggestions (Sydney-biased).
   */
  async function autocomplete(input) {
    if (!input || input.length < 2) return [];
    const response = await fetch(
      `${CONFIG.BACKEND_URL}/api/autocomplete?input=${encodeURIComponent(input)}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.predictions || [];
  }

  return { validateAndGeocode, searchCafes, getDistances, getPhotoUrl, autocomplete };
})();
