# CafeSpot

Find Sydney's best cafes within 5km of any suburb, sorted nearest to farthest.

---

## Project Structure

```
cafespot/
├── index.html          ← Main HTML page
├── app.py              ← Python Flask backend (API proxy)
├── requirements.txt    ← Python dependencies
├── css/
│   └── style.css       ← All styles
└── js/
    ├── config.js       ← API key & constants
    ├── api.js          ← Frontend API calls (to backend)
    ├── ui.js           ← Map, cards, modal rendering
    └── app.js          ← Main app logic & search flow
```

---

## Setup & Run

### 1. Install Python dependencies

```bash
cd cafespot
pip install -r requirements.txt
```

### 2. Start the Flask backend

```bash
python app.py
```

You should see:
```
CafeSpot backend running on http://localhost:5000
```

### 3. Open the frontend

Open `index.html` in a browser. You can either:
- Double-click `index.html` to open it directly, **or**
- Serve it with a simple HTTP server:

```bash
# Python 3
python -m http.server 8080
```

Then open: `http://localhost:8080`

> Make sure the Flask backend (`app.py`) is running on port 5000 before using the site.

---

## How It Works

1. **User types a Sydney suburb** → Autocomplete suggestions appear
2. **Address Validation + Geocoding API** → Validates the suburb is real and in Sydney, converts to lat/lng
3. **Places API (Nearby Search)** → Finds all cafes within 5km
4. **Distance Matrix API** → Gets driving distance & time from suburb to each cafe
5. **Results sorted** nearest → farthest, displayed as cards
6. **Map** shows all cafes as numbered markers with a 5km radius circle
7. **Click a card** → Modal with full details, hours, photo, directions link

---

## APIs Used

| API | Purpose |
|-----|---------|
| Maps JavaScript API | Interactive map with markers |
| Places API | Nearby cafe search |
| Geocoding API | Suburb name → lat/lng |
| Distance Matrix API | Driving distance to each cafe |
| Address Validation API | Validates suburb input |
| Routes API | (Available for future turn-by-turn directions) |

---

## Notes

- All Google API calls are made from the **Python backend** (`app.py`), not the browser, keeping the API key secure.
- The frontend only calls `localhost:5000/api/...` endpoints.
- Photos are proxied through the backend to avoid CORS issues.
- If Distance Matrix fails for any reason, the app falls back to straight-line distance sorting.
