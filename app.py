"""
CafeSpot — app.py
Python Flask backend that proxies Google Maps API calls.
Run: python app.py
"""

import os
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow requests from the frontend

API_KEY = "AIzaSyBBH5WNN660-YNrkQnGopV8y4cPOatnwNw"

GEOCODING_URL      = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_URL         = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL  = "https://maps.googleapis.com/maps/api/place/details/json"
DISTANCE_MATRIX_URL= "https://maps.googleapis.com/maps/api/distancematrix/json"
ADDR_VALIDATION_URL= "https://addressvalidation.googleapis.com/v1:validateAddress"
AUTOCOMPLETE_URL   = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
PHOTO_URL          = "https://maps.googleapis.com/maps/api/place/photo"


# ─── Geocode / Address Validation ────────────────────────────────────────────

@app.route("/api/geocode", methods=["POST"])
def geocode():
    """
    Validate suburb input using Address Validation API, then geocode.
    Body: { "suburb": "Surry Hills" }
    """
    data = request.get_json()
    suburb = (data or {}).get("suburb", "").strip()
    if not suburb:
        return jsonify({"valid": False, "error": "No suburb provided"}), 400

    # Append Sydney, NSW, Australia to bias results
    query = f"{suburb}, Sydney, NSW, Australia"

    # Step 1: Geocode
    geo_resp = requests.get(GEOCODING_URL, params={
        "address": query,
        "key": API_KEY,
        "region": "au",
        "components": "country:AU",
    }, timeout=10)

    geo_data = geo_resp.json()
    results  = geo_data.get("results", [])

    if not results:
        return jsonify({"valid": False, "error": f"Could not find '{suburb}' in Sydney."})

    best = results[0]
    location = best["geometry"]["location"]

    # Ensure result is in NSW / Sydney area (basic check)
    formatted = best.get("formatted_address", "")
    if "NSW" not in formatted and "New South Wales" not in formatted:
        return jsonify({"valid": False, "error": f"'{suburb}' doesn't appear to be in Sydney. Please try a Sydney suburb."})

    return jsonify({
        "valid": True,
        "lat": location["lat"],
        "lng": location["lng"],
        "formatted_address": formatted,
        "place_id": best.get("place_id"),
    })


# ─── Nearby Cafe Search ───────────────────────────────────────────────────────

@app.route("/api/cafes", methods=["POST"])
def search_cafes():
    """
    Search for cafes within radius using Places Nearby Search.
    Body: { "lat": -33.88, "lng": 151.21, "radius": 5000 }
    """
    data   = request.get_json()
    lat    = data.get("lat")
    lng    = data.get("lng")
    radius = data.get("radius", 5000)

    if lat is None or lng is None:
        return jsonify({"error": "lat/lng required"}), 400

    all_cafes = []
    next_page_token = None

    # Fetch up to 3 pages (60 results max)
    for _ in range(3):
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "cafe",
            "key": API_KEY,
        }
        if next_page_token:
            params["pagetoken"] = next_page_token

        resp = requests.get(PLACES_URL, params=params, timeout=10)
        resp_data = resp.json()

        if resp_data.get("status") not in ("OK", "ZERO_RESULTS"):
            return jsonify({"error": f"Places API error: {resp_data.get('status')}"}), 500

        places = resp_data.get("results", [])
        for place in places:
            loc = place["geometry"]["location"]
            cafe = {
                "place_id":           place.get("place_id"),
                "name":               place.get("name"),
                "vicinity":           place.get("vicinity"),
                "lat":                loc["lat"],
                "lng":                loc["lng"],
                "rating":             place.get("rating"),
                "user_ratings_total": place.get("user_ratings_total"),
                "price_level":        place.get("price_level"),
                "opening_hours":      place.get("opening_hours", {}).get("open_now"),
                "photo_reference":    (place.get("photos") or [{}])[0].get("photo_reference"),
            }
            all_cafes.append(cafe)

        next_page_token = resp_data.get("next_page_token")
        if not next_page_token:
            break

        # Google requires a short delay before using next_page_token
        import time
        time.sleep(2)

    return jsonify({"cafes": all_cafes})


# ─── Distance Matrix ──────────────────────────────────────────────────────────

@app.route("/api/distances", methods=["POST"])
def get_distances():
    """
    Use Distance Matrix API to get distances from origin to each cafe.
    Body: { "origin_lat": -33.88, "origin_lng": 151.21, "place_ids": ["ChIJ...", ...] }
    """
    data      = request.get_json()
    origin_lat = data.get("origin_lat")
    origin_lng = data.get("origin_lng")
    place_ids  = data.get("place_ids", [])

    if not place_ids:
        return jsonify({"distances": []})

    origin = f"{origin_lat},{origin_lng}"

    # Distance Matrix allows max 25 destinations per request
    CHUNK = 25
    all_distances = []

    for i in range(0, len(place_ids), CHUNK):
        chunk = place_ids[i:i + CHUNK]
        destinations = "|".join(f"place_id:{pid}" for pid in chunk)

        resp = requests.get(DISTANCE_MATRIX_URL, params={
            "origins":      origin,
            "destinations": destinations,
            "key":          API_KEY,
            "mode":         "driving",
            "units":        "metric",
        }, timeout=10)

        dm_data = resp.json()

        if dm_data.get("status") != "OK":
            # Return empty for this chunk rather than failing the whole request
            for pid in chunk:
                all_distances.append({"place_id": pid, "distance_text": None,
                                      "distance_value": 999999, "duration_text": None})
            continue

        rows = dm_data.get("rows", [{}])[0].get("elements", [])

        for j, element in enumerate(rows):
            pid = chunk[j]
            if element.get("status") == "OK":
                all_distances.append({
                    "place_id":       pid,
                    "distance_text":  element["distance"]["text"],
                    "distance_value": element["distance"]["value"],
                    "duration_text":  element["duration"]["text"],
                })
            else:
                all_distances.append({
                    "place_id": pid,
                    "distance_text": None,
                    "distance_value": 999999,
                    "duration_text": None,
                })

    return jsonify({"distances": all_distances})


# ─── Place Photo Proxy ────────────────────────────────────────────────────────

@app.route("/api/photo")
def get_photo():
    """
    Proxy Google Places photos to avoid CORS / API key exposure.
    Query params: ref=<photoReference>, maxwidth=<int>
    """
    ref      = request.args.get("ref", "")
    maxwidth = request.args.get("maxwidth", "400")

    if not ref:
        return jsonify({"error": "ref required"}), 400

    resp = requests.get(PHOTO_URL, params={
        "photoreference": ref,
        "maxwidth":       maxwidth,
        "key":            API_KEY,
    }, timeout=10, allow_redirects=True)

    return Response(
        resp.content,
        content_type=resp.headers.get("Content-Type", "image/jpeg"),
        status=resp.status_code,
    )


# ─── Autocomplete ─────────────────────────────────────────────────────────────

@app.route("/api/autocomplete")
def autocomplete():
    """
    Return Sydney-biased suburb autocomplete suggestions.
    Query param: input=<string>
    """
    user_input = request.args.get("input", "").strip()
    if not user_input:
        return jsonify({"predictions": []})

    resp = requests.get(AUTOCOMPLETE_URL, params={
        "input":      f"{user_input} Sydney",
        "key":        API_KEY,
        "types":      "(regions)",
        "components": "country:au",
        "location":   "-33.8688,151.2093",
        "radius":     "50000",
        "strictbounds": "true",
    }, timeout=10)

    ac_data = resp.json()
    predictions = [
        {"description": p["description"], "place_id": p.get("place_id")}
        for p in ac_data.get("predictions", [])
    ]

    return jsonify({"predictions": predictions})


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "CafeSpot API"})


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 CafeSpot backend running on http://localhost:5000")
    app.run(debug=True, port=5000)


# ─── Street View ──────────────────────────────────────────────────────────────

STREETVIEW_METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"
STREETVIEW_IMAGE_URL    = "https://maps.googleapis.com/maps/api/streetview"

@app.route("/api/streetview")
def get_streetview():
    """
    Proxy Street View Static API image.
    Query params: lat, lng, width, height
    First checks metadata to confirm Street View is available at the location.
    """
    lat    = request.args.get("lat", "")
    lng    = request.args.get("lng", "")
    width  = request.args.get("width",  "600")
    height = request.args.get("height", "300")

    if not lat or not lng:
        return jsonify({"error": "lat and lng required"}), 400

    # Check metadata first — avoid blank grey images
    meta_resp = requests.get(STREETVIEW_METADATA_URL, params={
        "location": f"{lat},{lng}",
        "key":      API_KEY,
    }, timeout=10)

    meta = meta_resp.json()
    if meta.get("status") != "OK":
        return jsonify({"available": False}), 404

    # Fetch the actual Street View image
    img_resp = requests.get(STREETVIEW_IMAGE_URL, params={
        "location": f"{lat},{lng}",
        "size":     f"{width}x{height}",
        "fov":      "90",
        "heading":  "0",
        "pitch":    "0",
        "key":      API_KEY,
    }, timeout=10)

    return Response(
        img_resp.content,
        content_type=img_resp.headers.get("Content-Type", "image/jpeg"),
        status=img_resp.status_code,
    )


@app.route("/api/streetview/check")
def check_streetview():
    """
    Check if Street View is available at a location without fetching the image.
    Returns: { available: true/false }
    """
    lat = request.args.get("lat", "")
    lng = request.args.get("lng", "")

    if not lat or not lng:
        return jsonify({"available": False})

    meta_resp = requests.get(STREETVIEW_METADATA_URL, params={
        "location": f"{lat},{lng}",
        "key":      API_KEY,
    }, timeout=10)

    meta = meta_resp.json()
    return jsonify({
        "available": meta.get("status") == "OK",
        "pano_id":   meta.get("pano_id"),
        "copyright": meta.get("copyright"),
    })
