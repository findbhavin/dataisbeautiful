#!/usr/bin/env python3
"""
Download India state GeoJSON and add POK (Pakistan-occupied Kashmir).
Uses a Ladakh-inclusive base source and datameet/maps for POK polygons.
"""
import urllib.request
import json
from pathlib import Path

INDIA_URL = "https://code.highcharts.com/mapdata/countries/in/in-all.geo.json"
POK_URL = "https://raw.githubusercontent.com/datameet/maps/master/Country/disputed/pok-alhasan.geojson"
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

    # Fetch base India GeoJSON
    with urllib.request.urlopen(INDIA_URL, timeout=15) as r:
        geojson = json.loads(r.read().decode())
    geojson = normalize_names(geojson)

    base_count = len(geojson.get("features", []))
    print(f"Loaded {base_count} India states")

    # Fetch and add POK GeoJSON (Azad Kashmir + Gilgit-Baltistan districts)
    try:
        with urllib.request.urlopen(POK_URL, timeout=15) as r:
            pok = json.loads(r.read().decode())
        for f in pok.get("features", []):
            if f.get("geometry"):
                props = f.get("properties", {})
                prov = props.get("PROVINCE", "POK")
                dist = props.get("DISTRICT", "")
                name = f"POK - {prov}" + (f" ({dist})" if dist else "")
                geojson["features"].append({
                    "type": "Feature",
                    "properties": {
                        "ID_0": 105, "ISO": "IND", "NAME_0": "India",
                        "NAME_1": name, "name": name, "TYPE_1": "Disputed",
                        "ENGTYPE_1": "Disputed Territory"
                    },
                    "geometry": f["geometry"]
                })
        print(f"Added {len(pok.get('features', []))} POK district(s)")
    except Exception as e:
        print(f"Could not add POK: {e}")

    with open(OUT, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Saved {len(geojson['features'])} features to {OUT}")


if __name__ == "__main__":
    main()
