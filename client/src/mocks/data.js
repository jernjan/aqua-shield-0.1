/**
 * Centralized mock data for all MVPs
 * Single source of truth for test/demo data
 */

// ============= AUTH DATA =============
export const MOCK_USERS = {
  'arne@farms.no': { 
    id: 'user_1', 
    name: 'Arne Anleggmann', 
    email: 'arne@farms.no', 
    role: 'farmer', 
    password: 'demo' 
  },
  'berit@farms.no': { 
    id: 'user_2', 
    name: 'Berit Fiskeoppdrett', 
    email: 'berit@farms.no', 
    role: 'farmer', 
    password: 'demo' 
  },
  'kare@shipping.no': { 
    id: 'user_3', 
    name: 'Kåre Båtrederi', 
    email: 'kare@shipping.no', 
    role: 'vessel_operator', 
    password: 'demo' 
  },
  'siri@shipping.no': { 
    id: 'user_4', 
    name: 'Siri Sjøtransport', 
    email: 'siri@shipping.no', 
    role: 'vessel_operator', 
    password: 'demo' 
  },
};

// ============= FARMER MVP DATA =============
export const MOCK_FARMS = [
  { id: 1, name: 'Anlegg Nord-Trøndelag', region: 'Nord-Trøndelag', riskScore: 78 },
  { id: 2, name: 'Anlegg Troms', region: 'Troms & Finnmark', riskScore: 65 },
  { id: 3, name: 'Anlegg Hordaland', region: 'Hordaland', riskScore: 45 },
  { id: 4, name: 'Anlegg Sogn', region: 'Sogn & Fjordane', riskScore: 32 },
  { id: 5, name: 'Anlegg Møre', region: 'Møre og Romsdal', riskScore: 55 },
  { id: 6, name: 'Anlegg Vest-Agder', region: 'Vest-Agder', riskScore: 42 },
];

export const MOCK_FARM_ALERTS = {
  1: [
    { id: 'a1', title: 'Høy lus-risiko', severity: 'risikofylt', farmId: 1, type: 'disease', isRead: false },
    { id: 'a2', title: 'Temperatur over grense', severity: 'høy oppmerksomhet', farmId: 1, type: 'environment', isRead: false },
  ],
  2: [
    { id: 'a3', title: 'Båtkontakt registrert', severity: 'moderat', farmId: 2, type: 'vessel', isRead: false },
  ],
};

export const getMockFarmData = (farmId) => ({
  alerts: [
    { id: 'a1', title: 'Høy lus-risiko', severity: 'risikofylt', type: 'disease', timestamp: new Date(), isRead: false },
    { id: 'a2', title: 'Temperatur over grense', severity: 'høy oppmerksomhet', type: 'environment', timestamp: new Date(), isRead: false },
  ],
  visitingVessels: [
    { id: 'v1', name: 'MV Nordlys', mmsi: '123456789', lastVisit: new Date() },
  ],
  quarantines: [
    { id: 'q1', reason: 'Fish health concerns', startDate: new Date(), endDate: new Date(Date.now() + 7*24*60*60*1000) }
  ],
  diseases: [
    { name: 'Sea lice', riskLevel: 'høy', cases: 5 },
  ]
});

// ============= VESSEL MVP DATA =============
export const MOCK_VESSELS = [
  { id: 1, name: 'MV Nordlys', mmsi: '123456789', type: 'Service Vessel', status: 'Active' },
  { id: 2, name: 'MV Atlantica', mmsi: '987654321', type: 'Transport', status: 'Active' },
];

export const getMockVesselData = (vesselId) => ({
  tasks: [
    { id: 1, type: 'karantene', name: 'Planlagt karantene', dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(), duration: 7 },
  ],
  disinfections: [
    { id: 1, date: new Date().toISOString(), chemical: 'Sodium hypochlorite', operator: 'John Doe', comment: 'Routine disinfection' },
  ]
});

// ============= ADMIN MVP DATA =============
export const MOCK_ADMIN_REGIONS = [
  { name: 'Nord-Trøndelag', status: 'normal', alerts: 3, lastUpdate: new Date() },
  { name: 'Troms & Finnmark', status: 'warning', alerts: 7, lastUpdate: new Date() },
  { name: 'Hordaland', status: 'normal', alerts: 1, lastUpdate: new Date() },
];

export const MOCK_ADMIN_STATISTICS = {
  totalAlerts: 24,
  activeOutbreaks: 3,
  quarantinedVessels: 5,
  confirmedCases: 12,
};

// ============= ANALYTICS MVP DATA =============
export const MOCK_ANALYTICS_DATA = {
  outbreak_timeline: [
    { week: 'Uke 1', cases: 0 },
    { week: 'Uke 2', cases: 2 },
    { week: 'Uke 3', cases: 5 },
    { week: 'Uke 4', cases: 8 },
  ],
  risk_by_region: [
    { region: 'Nord-Trøndelag', risk_score: 78 },
    { region: 'Troms & Finnmark', risk_score: 65 },
    { region: 'Hordaland', risk_score: 45 },
  ],
  disease_distribution: [
    { disease: 'Sea lice', percentage: 45 },
    { disease: 'Salmon Pancreas Disease', percentage: 30 },
    { disease: 'Infectious Salmon Anaemia', percentage: 25 },
  ],
};
