#!/usr/bin/env python3
"""Download India state GeoJSON from Subhash9325/GeoJson-Data-of-Indian-States."""
import urllib.request
import json
from pathlib import Path

URL = "https://raw.githubusercontent.com/Subhash9325/GeoJson-Data-of-Indian-States/master/Indian_States"
OUT = Path(__file__).parent.parent / "data" / "india" / "indian_states.geojson"

def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL) as r:
        data = r.read().decode()
    geojson = json.loads(data)
    with open(OUT, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Downloaded {len(geojson.get('features', []))} states to {OUT}")

if __name__ == "__main__":
    main()
