/**
 * Mock data for authentication and fallback data
 * Auth data is used for local login testing
 * Fallback functions used when APIs are unavailable
 */

// ============= AUTH DATA - Used for local login =============
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
  'lars@fisher.no': { 
    id: 'user_5', 
    name: 'Lars Fiskerisjef', 
    email: 'lars@fisher.no', 
    role: 'fisher', 
    password: 'demo' 
  },
  'gunnar@fisher.no': { 
    id: 'user_6', 
    name: 'Gunnar Fiskekontrollør', 
    email: 'gunnar@fisher.no', 
    role: 'fisher', 
    password: 'demo' 
  },
  'admin@aquashield.no': {
    id: 'admin_1',
    name: 'Administrator',
    email: 'admin@aquashield.no',
    role: 'admin',
    password: 'demo'
  },
};

// ============= FALLBACK DATA - Used when APIs unavailable =============
export const getMockFarmData = (farmId) => ({
  alerts: [
    { id: 'a1', title: 'Høy lus-risiko', severity: 'risikofylt', type: 'disease', timestamp: new Date(), isRead: false },
  ],
  visitingVessels: [],
  quarantines: [],
  diseases: []
});

export const getMockVesselData = (vesselId) => ({
  tasks: [],
  disinfections: []
});
