import json
from pathlib import Path

PROFILE_PATH = Path(__file__).parent / "data" / "profile.json"


def validate_profile(profile: dict) -> list[str]:
    errors: list[str] = []

    companies = profile.get("companies") or []
    vessels = profile.get("vessels") or []
    facilities = profile.get("facilities") or []
    events = profile.get("calendarEvents") or []
    scope = profile.get("scope") or {}

    recommended_max_vessels = int(scope.get("maxVessels") or 100)
    recommended_max_facilities_raw = scope.get("maxFacilities")
    recommended_max_facilities = (
        int(recommended_max_facilities_raw)
        if recommended_max_facilities_raw not in (None, "")
        else 0
    )

    company_ids = {company.get("id") for company in companies if company.get("id")}

    if len(vessels) > recommended_max_vessels:
        errors.append(
            f"For mange båter: {len(vessels)} (anbefalt maks: {recommended_max_vessels})"
        )

    if recommended_max_facilities > 0 and len(facilities) > recommended_max_facilities:
        errors.append(
            f"For mange anlegg: {len(facilities)} (anbefalt maks: {recommended_max_facilities})"
        )

    seen_mmsi: dict[str, str] = {}
    for vessel in vessels:
        vessel_id = vessel.get("id")
        if not vessel_id:
            errors.append("Vessel mangler id")
            continue

        if vessel.get("companyId") not in company_ids:
            errors.append(f"Vessel {vessel_id} har ukjent companyId: {vessel.get('companyId')}")

        mmsi = vessel.get("mmsi")
        if mmsi is None:
            continue

        mmsi_str = str(mmsi).strip()
        if not mmsi_str.isdigit():
            errors.append(f"Vessel {vessel_id} har ugyldig MMSI: {mmsi}")
            continue

        if mmsi_str in seen_mmsi:
            errors.append(
                f"Duplikat MMSI {mmsi_str} for {vessel_id} og {seen_mmsi[mmsi_str]}"
            )
        else:
            seen_mmsi[mmsi_str] = vessel_id

    facility_ids = {facility.get("id") for facility in facilities if facility.get("id")}

    for facility in facilities:
        facility_id = facility.get("id")
        if not facility_id:
            errors.append("Facility mangler id")
            continue

        if facility.get("companyId") not in company_ids:
            errors.append(f"Facility {facility_id} har ukjent companyId: {facility.get('companyId')}")

        locality_no = facility.get("localityNo")
        if locality_no is not None and not str(locality_no).isdigit():
            errors.append(f"Facility {facility_id} har ugyldig localityNo: {locality_no}")

    for event in events:
        event_id = event.get("id") or "(uten id)"
        if event.get("vesselId") not in {v.get("id") for v in vessels}:
            errors.append(f"Event {event_id} peker til ukjent vesselId: {event.get('vesselId')}")
        if event.get("facilityId") not in facility_ids:
            errors.append(f"Event {event_id} peker til ukjent facilityId: {event.get('facilityId')}")

    return errors


def main() -> int:
    if not PROFILE_PATH.exists():
        print(f"Fant ikke profilfil: {PROFILE_PATH}")
        return 1

    with PROFILE_PATH.open("r", encoding="utf-8") as f:
        profile = json.load(f)

    errors = validate_profile(profile)

    if errors:
        print("Validering feilet:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("Validering OK ✅")
    print(f"Profil: {profile.get('profileName')}")
    print(f"Båter: {len(profile.get('vessels') or [])}")
    print(f"Anlegg: {len(profile.get('facilities') or [])}")
    print(f"Hendelser: {len(profile.get('calendarEvents') or [])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
