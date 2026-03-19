/**
 * Job Store - Matching Engine for Pilot Lite
 * Handles job creation, vessel availability, and auto-matching suggestions
 */

const JOBS_STORE_KEY = 'pilotLiteJobsV1';
const JOB_TYPES = {
    DISINFECTION: 'desinfeksjon',
    DIVING: 'dykking',
    RENOVATION: 'renovasjon',
    SMOLT_TRANSPORT: 'smolt_transport',
    FISH_TRANSPORT: 'fisk_transport',
    SERVICE: 'service',
    INSPECTION: 'inspeksjon',
    OTHER: 'annet'
};

const JOB_STATUSES = {
    CREATED: 'opprettet',
    PROPOSAL_SENT: 'forslag_sendt',
    ACCEPTED: 'godtatt',
    IN_PROGRESS: 'pågår',
    COMPLETED: 'fullført',
    CANCELLED: 'avbrutt'
};

const BOAT_TYPES = {
    BRØNNBÅT: 'brønnbåt',
    SERVICEFARTØY: 'servicefartøy',
    TRANSPORT: 'transport',
    SMOLTBÅT: 'smolt_båt',
    INSPEKSJONSBÅT: 'inspeksjon_båt',
    ANNET: 'annet'
};

function loadJobStore() {
    try {
        const raw = localStorage.getItem(JOBS_STORE_KEY);
        if (!raw) return { jobs: {}, jobIdCounter: 0, matches: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { jobs: {}, jobIdCounter: 0, matches: {} };
        if (!parsed.jobs || typeof parsed.jobs !== 'object') parsed.jobs = {};
        if (!parsed.matches || typeof parsed.matches !== 'object') parsed.matches = {};
        if (!parsed.jobIdCounter || typeof parsed.jobIdCounter !== 'number') parsed.jobIdCounter = 0;
        return parsed;
    } catch (_) {
        return { jobs: {}, jobIdCounter: 0, matches: {} };
    }
}

function saveJobStore(store) {
    localStorage.setItem(JOBS_STORE_KEY, JSON.stringify(store));
}

function appendStatusTimeline(job, status, by = 'system', source = 'job-store') {
    if (!job || !status) return;
    const timeline = Array.isArray(job.statusTimeline) ? job.statusTimeline : [];
    timeline.push({
        status,
        at: new Date().toISOString(),
        by: String(by || 'system'),
        source: String(source || 'job-store')
    });
    job.statusTimeline = timeline.slice(-20);
}

export function createJob(facility) {
    const store = loadJobStore();
    const jobId = `JOB_${++store.jobIdCounter}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const preferredVesselIds = Array.isArray(facility?.preferredVesselIds)
        ? facility.preferredVesselIds.map((id) => String(id)).filter(Boolean)
        : [];
    const blockedVesselIds = Array.isArray(facility?.blockedVesselIds)
        ? facility.blockedVesselIds.map((id) => String(id)).filter(Boolean)
        : [];
    
    const job = {
        id: jobId,
        facilityId: facility.id,
        facilityName: facility.name,
        facilityCode: facility.code || facility.localityNo,
        facilityLat: facility.latitude,
        facilityLon: facility.longitude,
        
        jobType: facility.jobType || JOB_TYPES.SERVICE,
        requiredBoatTypes: facility.requiredBoatTypes || [],
        
        startDate: facility.startDate, // YYYY-MM-DD
        endDate: facility.endDate || facility.startDate,
        preferredTime: facility.preferredTime || '10:00',
        estimatedHours: facility.estimatedHours || 4,
        
        status: JOB_STATUSES.CREATED,
        priority: facility.priority || 'normal', // low, normal, high
        notes: facility.notes || '',
        preferredVesselIds,
        blockedVesselIds,
        
        createdAt: nowIso,
        createdBy: facility.createdBy || 'facility_op',
        updatedAt: nowIso,
        policySnapshotUpdatedAt: nowIso,
        statusTimeline: [{
            status: JOB_STATUSES.CREATED,
            at: nowIso,
            by: facility.createdBy || 'facility_op',
            source: 'createJob'
        }],
        
        proposals: [], // [{vesselId, vesselName, eta, rating, ...}]
        acceptedVesselId: null,
        completedAt: null
    };
    
    store.jobs[jobId] = job;
    store.matches[jobId] = [];
    saveJobStore(store);
    
    return job;
}

export function getJob(jobId) {
    const store = loadJobStore();
    return store.jobs[jobId] || null;
}

export function listJobs(facilityId = null, statusFilter = null) {
    const store = loadJobStore();
    let jobs = Object.values(store.jobs);
    
    if (facilityId) {
        jobs = jobs.filter(j => j.facilityId === facilityId);
    }
    if (statusFilter) {
        jobs = jobs.filter(j => j.status === statusFilter);
    }
    
    return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function updateJobStatus(jobId, newStatus, metadata = {}) {
    const store = loadJobStore();
    if (!store.jobs[jobId]) return null;
    if (!Object.values(JOB_STATUSES).includes(newStatus)) return null;
    if (store.jobs[jobId].status === newStatus) return store.jobs[jobId];
    
    store.jobs[jobId].status = newStatus;
    store.jobs[jobId].updatedAt = new Date().toISOString();
    appendStatusTimeline(
        store.jobs[jobId],
        newStatus,
        metadata.by || 'system',
        metadata.source || 'updateJobStatus'
    );
    
    if (newStatus === JOB_STATUSES.COMPLETED) {
        store.jobs[jobId].completedAt = new Date().toISOString();
    }
    
    saveJobStore(store);
    return store.jobs[jobId];
}

export function acceptJobProposal(jobId, vesselId) {
    const store = loadJobStore();
    if (!store.jobs[jobId]) return null;
    
    store.jobs[jobId].acceptedVesselId = vesselId;
    store.jobs[jobId].status = JOB_STATUSES.ACCEPTED;
    store.jobs[jobId].updatedAt = new Date().toISOString();
    appendStatusTimeline(store.jobs[jobId], JOB_STATUSES.ACCEPTED, 'vessel_op', 'acceptJobProposal');
    
    saveJobStore(store);
    return store.jobs[jobId];
}

export function updateJobPolicySnapshot(jobId, preferredVesselIds = [], blockedVesselIds = []) {
    const store = loadJobStore();
    const job = store.jobs[jobId];
    if (!job) return null;

    job.preferredVesselIds = Array.isArray(preferredVesselIds)
        ? preferredVesselIds.map((id) => String(id)).filter(Boolean)
        : [];
    job.blockedVesselIds = Array.isArray(blockedVesselIds)
        ? blockedVesselIds.map((id) => String(id)).filter(Boolean)
        : [];
    job.updatedAt = new Date().toISOString();
    job.policySnapshotUpdatedAt = new Date().toISOString();

    saveJobStore(store);
    return job;
}

/**
 * MATCHING ENGINE
 * Finds vessels that can fulfill a job based on:
 * - Location (radius)
 * - Availability (calendar)
 * - Boat type capability
 * - Clearance status
 */

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula in km
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Find vessels near job location within radius
 */
export function findVesselsInRadius(job, vessels, radiusKm = 50) {
    if (!job.facilityLat || !job.facilityLon || !Array.isArray(vessels)) return [];
    
    return vessels.filter(vessel => {
        if (!vessel.latitude || !vessel.longitude) return false;
        const dist = calculateDistance(
            job.facilityLat, job.facilityLon,
            vessel.latitude, vessel.longitude
        );
        return dist <= radiusKm;
    });
}

/**
 * Check if vessel is available on job dates
 * Returns available time slots and conflicts
 */
export function checkVesselAvailability(vessel, jobStartDate, jobEndDate, calendar = {}) {
    const conflicts = [];
    const availableSlots = [];
    
    const start = new Date(jobStartDate);
    const end = new Date(jobEndDate);
    const current = new Date(start);
    
    while (current <= end) {
        const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        const dayCalendar = calendar[vessel.id]?.[dateKey] || [];
        
        if (dayCalendar.length > 0) {
            conflicts.push({
                date: dateKey,
                events: dayCalendar
            });
        } else {
            availableSlots.push(dateKey);
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return {
        available: availableSlots.length > 0,
        availableSlots,
        conflicts,
        conflictDays: conflicts.length,
        availabilityScore: availableSlots.length / (end.getDate() - start.getDate() + 1)
    };
}

/**
 * Main matching function
 * Returns ranked list of best-match vessels for the job
 */
export function matchVesselsForJob(job, vessels, calendar = {}, vesselClearances = new Map()) {
    if (!vessels || vessels.length === 0) return [];
    const preferredSet = new Set(Array.isArray(job?.preferredVesselIds) ? job.preferredVesselIds.map((id) => String(id)) : []);
    const blockedSet = new Set(Array.isArray(job?.blockedVesselIds) ? job.blockedVesselIds.map((id) => String(id)) : []);
    
    const candidates = [];
    
    for (const vessel of vessels) {
        const vesselId = String(vessel?.id || '');
        if (!vesselId) continue;
        if (blockedSet.has(vesselId)) continue;
        if (preferredSet.size > 0 && !preferredSet.has(vesselId)) continue;

        const candidate = {
            vessel,
            score: 0,
            reasons: [],
            issues: []
        };
        if (preferredSet.has(vesselId)) {
            candidate.score += 8;
            candidate.reasons.push('Foretrukket av anlegget');
        }
        const intervalMeta = vessel.__jobMatchMeta || {};
        
        // 1. Location score (0-30 points)
        if (vessel.latitude && vessel.longitude) {
            const dist = calculateDistance(
                job.facilityLat, job.facilityLon,
                vessel.latitude, vessel.longitude
            );
            if (dist <= 20) {
                candidate.score += 30;
                candidate.reasons.push(`Nær anlegg (${dist.toFixed(1)} km)`);
            } else if (dist <= 50) {
                candidate.score += 20;
                candidate.reasons.push(`Moderat avstand (${dist.toFixed(1)} km)`);
            } else if (dist <= 100) {
                candidate.score += 10;
                candidate.reasons.push(`Akseptabel avstand (${dist.toFixed(1)} km)`);
            } else {
                candidate.issues.push(`For langt unna (${dist.toFixed(1)} km)`);
            }
        }

        // 1b. Reward vessels that already operate in the area for the requested period (0-25 points)
        if (intervalMeta.intervalFit) {
            candidate.score += 25;
            candidate.reasons.push(`I området og ledig hele perioden (${intervalMeta.coveredDays || 0}/${intervalMeta.totalDays || 0} dager)`);
        } else if (intervalMeta.freeCoveredDays > 0) {
            const ratio = intervalMeta.totalDays > 0 ? intervalMeta.freeCoveredDays / intervalMeta.totalDays : 0;
            candidate.score += Math.round(18 * ratio);
            candidate.reasons.push(`Kan ta deler av perioden (${intervalMeta.freeCoveredDays || 0}/${intervalMeta.totalDays || 0} dager)`);
            if (intervalMeta.busyDays > 0) {
                candidate.issues.push(`Opptatt ${intervalMeta.busyDays} dag(er) i perioden`);
            }
        }
        
        // 2. Boat type match (0-25 points)
        if (job.requiredBoatTypes && job.requiredBoatTypes.length > 0) {
            const vesselType = vessel.category || vessel.type || '';
            if (job.requiredBoatTypes.includes(vesselType)) {
                candidate.score += 25;
                candidate.reasons.push(`Riktig båttype (${vesselType})`);
            } else {
                candidate.score += 5;
                candidate.reasons.push(`Annen båttype (${vesselType})`);
            }
        } else {
            candidate.score += 5;
            candidate.reasons.push('Fleksibel båttype');
        }
        
        // 3. Availability (0-25 points)
        const availability = checkVesselAvailability(vessel, job.startDate, job.endDate, calendar);
        if (availability.available) {
            candidate.score += 25 * availability.availabilityScore;
            candidate.reasons.push(`Ledig ${availability.availableSlots.length}/${availability.availableSlots.length + availability.conflictDays} dager`);
        } else {
            candidate.issues.push('Ikke ledig på ønsket dato');
        }

        // 3b. Bonus for low repositioning cost when already near job corridor (0-10 points)
        if (Number.isFinite(intervalMeta.nearestDistanceKm)) {
            if (intervalMeta.nearestDistanceKm <= 15) {
                candidate.score += 10;
                candidate.reasons.push(`Svært lav dødtransport (${intervalMeta.nearestDistanceKm.toFixed(1)} km)`);
            } else if (intervalMeta.nearestDistanceKm <= 35) {
                candidate.score += 6;
                candidate.reasons.push(`Lav dødtransport (${intervalMeta.nearestDistanceKm.toFixed(1)} km)`);
            }
        }
        
        // 4. Clearance status (0-20 points)
        const clearance = vesselClearances.get(vessel.mmsi);
        if (clearance?.cleared === true && clearance?.quarantineCompleted && clearance?.disinfectionCompleted) {
            candidate.score += 20;
            candidate.reasons.push('Karantene og desinfeksjon fullført');
        } else if (clearance?.cleared === true) {
            candidate.score += 10;
            candidate.reasons.push('Delvis klarert');
        } else {
            candidate.issues.push('Ikke klarert - karantene/desinfeksjon påkrevd');
        }
        
        // Only include candidates with positive score or fixable issues
        if (candidate.score > 0) {
            candidates.push(candidate);
        }
    }
    
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates;
}

/**
 * Generate proposal for vessel to fulfill job
 */
export function generateProposal(vessel, job, matchCandidate) {
    const proposal = {
        vesselId: vessel.id,
        vesselName: vessel.name,
        vesselMmsi: vessel.mmsi,
        vesselType: vessel.category || vessel.type,
        
        jobId: job.id,
        jobType: job.jobType,
        
        proposedStartDate: job.startDate,
        proposedEndDate: job.endDate,
        proposedTime: job.preferredTime,
        
        estimatedEta: calculateETA(vessel, job),
        estimatedDuration: job.estimatedHours,
        coveredDays: matchCandidate.vessel?.__jobMatchMeta?.coveredDays || 0,
        totalDays: matchCandidate.vessel?.__jobMatchMeta?.totalDays || 0,
        intervalFit: matchCandidate.vessel?.__jobMatchMeta?.intervalFit === true,
        
        matchScore: matchCandidate.score,
        matchReasons: matchCandidate.reasons,
        matchIssues: matchCandidate.issues,
        
        status: 'pending', // pending, accepted, rejected, alternative_offered
        createdAt: new Date().toISOString(),
        responseDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    return proposal;
}

function calculateETA(vessel, job) {
    // Simple ETA: assume 18.52 km/h speed (typical for service vessels)
    const SPEED_KMH = 18.52;
    if (!vessel.latitude || !vessel.longitude) return null;
    
    const dist = calculateDistance(
        vessel.latitude, vessel.longitude,
        job.facilityLat, job.facilityLon
    );
    const hoursToTravel = dist / SPEED_KMH;
    
    const eta = new Date();
    eta.setHours(eta.getHours() + Math.ceil(hoursToTravel));
    
    return eta.toISOString();
}

/**
 * Add proposals to job
 */
export function addProposalsToJob(jobId, proposals) {
    const store = loadJobStore();
    if (!store.jobs[jobId]) return null;
    
    store.jobs[jobId].proposals = proposals.map(p => ({
        ...p,
        createdAt: new Date().toISOString()
    }));
    store.jobs[jobId].updatedAt = new Date().toISOString();
    
    saveJobStore(store);
    return store.jobs[jobId];
}

/**
 * Get active jobs (not completed/cancelled)
 */
export function getActiveJobs() {
    const store = loadJobStore();
    return Object.values(store.jobs).filter(job => 
        ![JOB_STATUSES.COMPLETED, JOB_STATUSES.CANCELLED].includes(job.status)
    );
}

/**
 * Get jobs for facility with upcoming proposals
 */
export function getJobsWithProposals(facilityId) {
    const jobs = listJobs(facilityId, null);
    return jobs.filter(job => job.proposals && job.proposals.length > 0);
}

export { JOB_TYPES, JOB_STATUSES, BOAT_TYPES };
