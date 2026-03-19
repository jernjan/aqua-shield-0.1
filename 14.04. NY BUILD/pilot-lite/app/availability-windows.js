const DEFAULT_OPTIONS = {
    beforeHours: 12,
    afterHours: 36,
    mergeRadiusKm: 45,
    zoneRadiusKm: 35
};

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(value) {
    const date = toDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function distanceKmBetween(a, b) {
    const lat1 = toNumber(a?.latitude ?? a?.lat);
    const lon1 = toNumber(a?.longitude ?? a?.lon);
    const lat2 = toNumber(b?.latitude ?? b?.lat);
    const lon2 = toNumber(b?.longitude ?? b?.lon);
    if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const q = sinLat * sinLat + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * sinLon * sinLon;
    return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function normalizeWindowEvent(event, facilityResolver) {
    const type = String(event?.type || 'visit').toLowerCase();
    if (!['visit', 'operation'].includes(type)) return null;

    const start = toDate(event?.start || event?.date);
    const end = toDate(event?.end || start);
    if (!start || !end) return null;

    const facility = facilityResolver ? facilityResolver(event?.facilityId, event) : null;
    const latitude = toNumber(facility?.latitude ?? event?.latitude);
    const longitude = toNumber(facility?.longitude ?? event?.longitude);
    if (latitude === null || longitude === null) return null;

    return {
        id: event?.id || `evt_${start.getTime()}`,
        vesselId: event?.vesselId || '',
        facilityId: event?.facilityId || facility?.id || '',
        facilityName: event?.facilityName || facility?.name || 'Område',
        municipality: facility?.municipality || event?.municipality || '',
        latitude,
        longitude,
        start,
        end,
        type
    };
}

export function deriveAvailabilityWindows(events, facilityResolver, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const normalized = (events || [])
        .map((event) => normalizeWindowEvent(event, facilityResolver))
        .filter(Boolean)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const windows = [];
    for (const event of normalized) {
        const candidate = {
            id: `zone_${event.id}`,
            vesselId: event.vesselId,
            start: new Date(event.start.getTime() - config.beforeHours * 60 * 60 * 1000),
            end: new Date(event.end.getTime() + config.afterHours * 60 * 60 * 1000),
            radiusKm: config.zoneRadiusKm,
            facilities: [{
                id: event.facilityId,
                name: event.facilityName,
                municipality: event.municipality,
                latitude: event.latitude,
                longitude: event.longitude,
                eventStart: event.start.toISOString(),
                eventEnd: event.end.toISOString()
            }],
            primaryFacilityId: event.facilityId,
            primaryFacilityName: event.facilityName,
            municipality: event.municipality,
            latitude: event.latitude,
            longitude: event.longitude,
            eventCount: 1,
            eventIds: [event.id]
        };

        const previous = windows[windows.length - 1];
        const distance = previous ? distanceKmBetween(previous, candidate) : null;
        const shouldMerge = Boolean(previous)
            && (distance === null || distance <= config.mergeRadiusKm)
            && candidate.start.getTime() <= previous.end.getTime();

        if (shouldMerge) {
            previous.end = new Date(Math.max(previous.end.getTime(), candidate.end.getTime()));
            previous.eventCount += 1;
            previous.eventIds.push(...candidate.eventIds);
            previous.facilities.push(...candidate.facilities.filter((facility) => !previous.facilities.some((item) => String(item.id) === String(facility.id))));
            continue;
        }

        windows.push(candidate);
    }

    return windows.map((window, index) => ({
        ...window,
        id: `${window.id}_${index}`,
        title: `Tilstede i område · ${window.municipality || window.primaryFacilityName || 'Arbeidsområde'}`,
        status: 'tilgjengelig',
        type: 'presence'
    }));
}

export function buildPresenceEvents(events, facilityResolver, options = {}) {
    return deriveAvailabilityWindows(events, facilityResolver, options).map((window) => ({
        id: window.id,
        vesselId: window.vesselId,
        facilityId: window.primaryFacilityId,
        facilityName: window.primaryFacilityName,
        title: window.title,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        type: 'presence',
        status: 'tilgjengelig',
        planned: true,
        source: 'derived',
        derivedWindow: true,
        windowFacilityCount: window.facilities.length,
        comment: window.facilities.length > 1
            ? `${window.facilities.length} anlegg i samme arbeidsområde`
            : 'Buffer før/etter oppdrag i området'
    }));
}
