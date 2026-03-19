/**
 * User Role Management System
 * Handles user authentication, role management, and permission checking
 * Uses localStorage for persistence (for development/testing)
 */

const RoleSystem = (() => {
  const STORAGE_KEY = 'kyst_monitor_user';
  const ROLES_URL = './shared-roles.json';
  
  // Default test user
  const DEFAULT_USER = {
    id: 'test-user-001',
    name: 'Test User',
    email: 'test@kystmonitor.no',
    role: 'ADMIN',
    assigned_facilities: [],
    assigned_vessels: [],
    created_at: new Date().toISOString()
  };

  let roles = null;
  let currentUser = null;

  /**
   * Load role definitions from shared-roles.json
   */
  async function loadRoles() {
    if (roles) return roles;
    
    try {
      const response = await fetch(ROLES_URL);
      if (!response.ok) throw new Error('Failed to load roles');
      const data = await response.json();
      roles = data.roles;
      console.log('✓ Role definitions loaded');
      return roles;
    } catch (error) {
      console.error('Error loading roles:', error);
      return null;
    }
  }

  /**
   * Initialize user from localStorage or create default
   */
  function initializeUser() {
    let storedUser = localStorage.getItem(STORAGE_KEY);
    
    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser);
        console.log(`✓ User loaded: ${currentUser.name} (${currentUser.role})`);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        currentUser = { ...DEFAULT_USER };
      }
    } else {
      currentUser = { ...DEFAULT_USER };
      saveUser(currentUser);
      console.log('✓ Default test user created');
    }
    
    return currentUser;
  }

  /**
   * Get current user
   */
  function getCurrentUser() {
    if (!currentUser) {
      initializeUser();
    }
    return currentUser;
  }

  /**
   * Save user to localStorage
   */
  function saveUser(user) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      currentUser = user;
      console.log(`✓ User saved: ${user.name} (${user.role})`);
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  /**
   * Set user role (for testing/switching roles)
   */
  function setUserRole(role) {
    if (!currentUser) {
      initializeUser();
    }
    
    const validRoles = Object.keys(roles || {});
    if (!validRoles.includes(role)) {
      console.error(`Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}`);
      return false;
    }
    
    currentUser.role = role;
    saveUser(currentUser);
    console.log(`✓ User role changed to: ${role}`);
    
    // Trigger UI update
    window.dispatchEvent(new CustomEvent('userRoleChanged', { detail: { role } }));
    
    return true;
  }

  /**
   * Set assigned facilities for current user
   */
  function setAssignedFacilities(facilityIds) {
    if (!currentUser) {
      initializeUser();
    }
    
    currentUser.assigned_facilities = Array.isArray(facilityIds) ? facilityIds : [];
    saveUser(currentUser);
    console.log(`✓ Assigned facilities set: ${facilityIds.length} facilities`);
    
    window.dispatchEvent(new CustomEvent('userAssignmentsChanged', { 
      detail: { facilities: facilityIds } 
    }));
    
    return true;
  }

  /**
   * Set assigned vessels for current user
   */
  function setAssignedVessels(vesselIds) {
    if (!currentUser) {
      initializeUser();
    }
    
    currentUser.assigned_vessels = Array.isArray(vesselIds) ? vesselIds : [];
    saveUser(currentUser);
    console.log(`✓ Assigned vessels set: ${vesselIds.length} vessels`);
    
    window.dispatchEvent(new CustomEvent('userAssignmentsChanged', { 
      detail: { vessels: vesselIds } 
    }));
    
    return true;
  }

  /**
   * Check if user has permission
   */
  function hasPermission(permissionKey) {
    if (!currentUser || !roles) return false;
    
    const userRole = roles[currentUser.role];
    if (!userRole) return false;
    
    return userRole.permissions[permissionKey] === true;
  }

  /**
   * Check if user can view all facilities
   */
  function canViewAllFacilities() {
    return hasPermission('view_all_facilities');
  }

  /**
   * Check if user can view assigned facilities
   */
  function canViewAssignedFacilities() {
    return hasPermission('view_assigned_facilities');
  }

  /**
   * Filter facilities based on user role and assignments
   */
  function filterFacilities(facilities) {
    if (!Array.isArray(facilities)) return [];
    if (!currentUser) {
      initializeUser();
    }

    // Admins see all
    if (currentUser.role === 'ADMIN') {
      return facilities;
    }

    // Operators and viewers see only assigned
    if (currentUser.assigned_facilities.length === 0) {
      return []; // No facilities assigned
    }

    return facilities.filter(f => 
      currentUser.assigned_facilities.includes(f.facility_id || f.id)
    );
  }

  /**
   * Filter vessels based on user role and assignments
   */
  function filterVessels(vessels) {
    if (!Array.isArray(vessels)) return [];
    if (!currentUser) {
      initializeUser();
    }

    // Admins see all
    if (currentUser.role === 'ADMIN') {
      return vessels;
    }

    // Operators and viewers see only assigned
    if (currentUser.assigned_vessels.length === 0) {
      return []; // No vessels assigned
    }

    return vessels.filter(v => 
      currentUser.assigned_vessels.includes(v.vessel_id || v.id || v.mmsi)
    );
  }

  /**
   * Get role information
   */
  function getRoleInfo(roleKey) {
    if (!roles) return null;
    return roles[roleKey] || null;
  }

  /**
   * Get all available roles
   */
  function getAvailableRoles() {
    if (!roles) return [];
    return Object.keys(roles).map(key => ({
      key,
      ...roles[key]
    }));
  }

  /**
   * Clear user (logout)
   */
  function clearUser() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      currentUser = null;
      console.log('✓ User cleared');
      
      window.dispatchEvent(new CustomEvent('userCleared'));
      
      return true;
    } catch (error) {
      console.error('Error clearing user:', error);
      return false;
    }
  }

  /**
   * Initialize on load
   */
  async function init() {
    console.log('Initializing RoleSystem...');
    await loadRoles();
    initializeUser();
    console.log('✓ RoleSystem initialized');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    init,
    getCurrentUser,
    setUserRole,
    setAssignedFacilities,
    setAssignedVessels,
    hasPermission,
    canViewAllFacilities,
    canViewAssignedFacilities,
    filterFacilities,
    filterVessels,
    getRoleInfo,
    getAvailableRoles,
    saveUser,
    clearUser,
    loadRoles
  };
})();

// Expose globals for console access
window.RoleSystem = RoleSystem;
console.log('RoleSystem available as window.RoleSystem');
