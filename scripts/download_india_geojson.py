#!/usr/bin/env python3
"""Download India state GeoJSON (Ladakh-inclusive) and normalize names."""
import urllib.request
import json
from pathlib import Path

URL = "https://code.highcharts.com/mapdata/countries/in/in-all.geo.json"
OUT = Path(__file__).parent.parent / "data" / "india" / "indian_states.geojson"


def normalize_names(geojson: dict) -> dict:
    alias_map = {
        "Andaman and Nicobar Islands": "Andaman and Nicobar",
    }
    for feature in geojson.get("features", []):
        props = feature.setdefault("properties", {})
        raw_name = props.get("NAME_1") or props.get("name")
        if not raw_name:
            continue
        canonical = alias_map.get(raw_name, raw_name)
        props["NAME_1"] = canonical
        props["name"] = canonical
    return geojson


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL) as r:
        data = r.read().decode()
    geojson = json.loads(data)
    geojson = normalize_names(geojson)
    with open(OUT, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Downloaded {len(geojson.get('features', []))} states to {OUT}")

if __name__ == "__main__":
    main()
