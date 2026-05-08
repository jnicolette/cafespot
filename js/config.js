// js/config.js — CafeSpot configuration

const CONFIG = {
  GOOGLE_API_KEY: 'AIzaSyAyhvagv40seo7ezXCU1n0h9v_UtwcjqkY',
  SEARCH_RADIUS_METERS: 5000,
  PLACE_TYPE: 'cafe',
  MAX_RESULTS: 20,

  // Default map center (Sydney CBD)
  DEFAULT_CENTER: { lat: -33.8688, lng: 151.2093 },
  DEFAULT_ZOOM: 13,
  RESULTS_ZOOM: 14,

  // Backend base URL (Python Flask server)
  BACKEND_URL: 'http://localhost:5000',
};
