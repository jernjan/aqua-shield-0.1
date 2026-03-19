import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_PROFILE_PATH = Path(__file__).parent / "data" / "profile.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Utvid profile.json med nærliggende anlegg innenfor radius fra seed-anlegg"
    )
    parser.add_argument("--profile", default=str(DEFAULT_PROFILE_PATH), help="Path til profile.json")
    parser.add_argument("--api-base", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--radius-km", type=float, default=None, help="Radius i km")
    parser.add_argument("--max-facilities", type=int, default=None, help="Maks antall anlegg i profilen")
    parser.add_argument("--limit", type=int, default=500, help="API page size")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout i sekunder")
    parser.add_argument("--dry-run", action="store_true", help="Ikke skriv fil, bare vis resultat")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def parse_coordinate(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if math.isfinite(num) else None
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            return None
        try:
            num = float(cleaned)
            return num if math.isfinite(num) else None
        except ValueError:
            return None
    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "facility"


def normalize_locality(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text if text.isdigit() else None


def normalize_name(facility: dict[str, Any]) -> str:
    return (
        str(
            facility.get("name")
            or facility.get("facility_name")
            or facility.get("display_name")
            or ""
        )
        .strip()
    )


def build_candidate(profile_facility: dict[str, Any], external_company_id: str) -> dict[str, Any]:
    name = normalize_name(profile_facility)
    locality_no = normalize_locality(profile_facility.get("localityNo") or profile_facility.get("code"))
    latitude = parse_coordinate(profile_facility.get("latitude"))
    longitude = parse_coordinate(profile_facility.get("longitude"))
    municipality = (
        profile_facility.get("municipality")
        or profile_facility.get("municipality_name")
        or profile_facility.get("municipalityName")
    )

    if locality_no:
        facility_id = f"loc-{locality_no}"
    else:
        lat_part = f"{latitude:.3f}" if latitude is not None else "na"
        lon_part = f"{longitude:.3f}" if longitude is not None else "na"
        facility_id = f"auto-{slugify(name)}-{lat_part}-{lon_part}".replace(".", "_")

    return {
        "id": facility_id,
        "name": name or facility_id,
        "companyId": external_company_id,
        "municipality": municipality or "Ukjent",
        "localityNo": locality_no,
        "latitude": latitude,
        "longitude": longitude,
        "tags": ["nearby-auto"],
    }


def facility_keys(facility: dict[str, Any]) -> set[str]:
    keys: set[str] = set()
    facility_id = str(facility.get("id") or "").strip()
    if facility_id:
        keys.add(f"id:{facility_id.lower()}")

    locality_no = normalize_locality(facility.get("localityNo") or facility.get("code"))
    if locality_no:
        keys.add(f"loc:{locality_no}")

    name = normalize_name(facility).lower()
    lat = parse_coordinate(facility.get("latitude"))
    lon = parse_coordinate(facility.get("longitude"))
    if name and lat is not None and lon is not None:
        keys.add(f"namegeo:{name}|{lat:.4f}|{lon:.4f}")
    elif name:
        keys.add(f"name:{name}")

    return keys


def fetch_all_facilities(api_base: str, limit: int, timeout: float) -> list[dict[str, Any]]:
    all_rows: list[dict[str, Any]] = []
    skip = 0
    while True:
        query = urlencode({"limit": limit, "skip": skip})
        url = f"{api_base.rstrip('/')}/api/facilities?{query}"
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rows = payload.get("facilities") or []
        if not isinstance(rows, list):
            raise ValueError("Ugyldig API-format: facilities er ikke liste")
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        skip += limit
        if skip > 20000:
            break
    return all_rows


def ensure_external_company(profile: dict[str, Any], external_company_id: str) -> None:
    companies = profile.setdefault("companies", [])
    if any((c.get("id") == external_company_id) for c in companies if isinstance(c, dict)):
        return
    companies.append(
        {
            "id": external_company_id,
            "name": "Nærliggende anlegg",
            "role": "External Facility Operator",
        }
    )


def main() -> int:
    args = parse_args()
    profile_path = Path(args.profile)
    if not profile_path.exists():
        print(f"Fant ikke profil: {profile_path}")
        return 1

    profile = load_json(profile_path)
    scope = profile.setdefault("scope", {})

    radius_km = args.radius_km if args.radius_km is not None else float(scope.get("nearbyFacilityRadiusKm") or 20)
    max_facilities_raw = args.max_facilities if args.max_facilities is not None else scope.get("maxFacilities")
    max_facilities = int(max_facilities_raw) if max_facilities_raw not in (None, "") else 0
    external_company_id = str(scope.get("externalFacilityCompanyId") or "nearby-external")

    facilities = profile.setdefault("facilities", [])

    def is_auto_entry(facility: dict[str, Any]) -> bool:
        tags = facility.get("tags") or []
        return isinstance(tags, list) and "nearby-auto" in tags

    base_seed_facilities = [f for f in facilities if not is_auto_entry(f)]
    seeds = [
        f for f in base_seed_facilities
        if parse_coordinate(f.get("latitude")) is not None and parse_coordinate(f.get("longitude")) is not None
    ]

    if not seeds:
        seeds = [
            f for f in facilities
            if parse_coordinate(f.get("latitude")) is not None and parse_coordinate(f.get("longitude")) is not None
        ]

    if not seeds:
        print("Ingen seed-anlegg med koordinater i profile.json")
        return 1

    print(f"Henter anlegg fra API ({args.api_base})...")
    try:
        api_facilities = fetch_all_facilities(args.api_base, args.limit, args.timeout)
    except Exception as error:
        print(f"Klarte ikke hente anlegg: {error}")
        return 1

    print(f"Totalt hentet: {len(api_facilities)} anlegg")

    seen: set[str] = set()
    for item in base_seed_facilities:
        seen.update(facility_keys(item))

    ranked: list[tuple[float, dict[str, Any]]] = []
    for raw in api_facilities:
        lat = parse_coordinate(raw.get("latitude"))
        lon = parse_coordinate(raw.get("longitude"))
        if lat is None or lon is None:
            continue

        min_distance = math.inf
        for seed in seeds:
            seed_lat = parse_coordinate(seed.get("latitude"))
            seed_lon = parse_coordinate(seed.get("longitude"))
            if seed_lat is None or seed_lon is None:
                continue
            distance = haversine_km(seed_lat, seed_lon, lat, lon)
            if distance < min_distance:
                min_distance = distance

        if min_distance <= radius_km:
            candidate = build_candidate(raw, external_company_id)
            candidate["_distance_km"] = min_distance
            ranked.append((min_distance, candidate))

    ranked.sort(key=lambda item: item[0])

    base_count = len(base_seed_facilities)
    additions: list[dict[str, Any]] = []
    for distance, candidate in ranked:
        if max_facilities > 0 and len(base_seed_facilities) + len(additions) >= max_facilities:
            break

        keys = facility_keys(candidate)
        if any(key in seen for key in keys):
            continue

        candidate.pop("_distance_km", None)
        additions.append(candidate)
        seen.update(keys)

    scope["nearbyFacilityRadiusKm"] = radius_km
    scope["maxFacilities"] = max_facilities
    scope["externalFacilityCompanyId"] = external_company_id

    if additions:
        ensure_external_company(profile, external_company_id)

    profile["facilities"] = base_seed_facilities + additions

    print(f"Seed-anlegg: {base_count}")
    print(f"Nye nærliggende anlegg lagt til: {len(additions)}")
    if max_facilities > 0:
        print(f"Totalt i profil: {len(profile['facilities'])} / maks {max_facilities}")
    else:
        print(f"Totalt i profil: {len(profile['facilities'])} (ingen maks-grense)")
    print(f"Radius: {radius_km} km")

    if args.dry_run:
        print("Dry-run: ingen fil ble skrevet")
        return 0

    backup_path = profile_path.with_suffix(".json.bak")
    save_json(backup_path, load_json(profile_path))
    save_json(profile_path, profile)
    print(f"Skrev oppdatert profil: {profile_path}")
    print(f"Backup: {backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
