# 🔍 AquaShield Frontend Data Status Report

**Date**: 2026-01-11  
**Reviewed**: Main dashboard + all 5 MVPs

---

## 📊 Current State Analysis

### ✅ What's Working
1. **Authentication** - 4 mock users (2 farmers, 2 vessel operators)
2. **Navigation** - All 5 MVPs accessible
3. **UI/Layout** - Professional design, responsive
4. **API Endpoints** - 58+ endpoints created and documented
5. **Backend Data** - 100 farms, 8 vessels, 8 fishers, BarentsWatch integration
6. **FisherDashboard** - Fully functional with new 3-column layout
7. **AdminMVP** - Fetches BarentsWatch data (with caching)

### ❌ Critical Issues

#### Issue #1: Data Disconnect
- **Problem**: Frontend uses hardcoded MOCK_USERS (2 users) instead of backend user list
- **Impact**: Only 2 farmers + 2 vessel operators available, missing fisher accounts
- **Root Cause**: No `/api/users` endpoint or user service
- **Status**: 🔴 BLOCKING - Authentication should come from backend

#### Issue #2: Dashboard Data Not Real
- **Problem**: FarmerMVP shows 6 hardcoded farms instead of 100 in backend
- **Impact**: Users don't see their actual facilities
- **Root Cause**: Frontend uses `MOCK_FARMS` instead of calling `/api/mvp/farmer`
- **Status**: 🔴 BLOCKING - Should fetch from backend

#### Issue #3: Vessel Data Hardcoded
- **Problem**: VesselMVP shows 2 hardcoded vessels instead of 8 in backend
- **Impact**: Users don't see real vessel list
- **Root Cause**: Uses `MOCK_VESSELS` instead of `/api/mvp/vessel`
- **Status**: 🔴 BLOCKING - Should fetch from backend

#### Issue #4: No User Context in API Calls
- **Problem**: Endpoints like `/api/mvp/farmer` don't filter by `userId`
- **Impact**: One user sees all facilities (data leak / confusion)
- **Root Cause**: No JWT token or userId passed in requests
- **Status**: 🔴 BLOCKING - Need authentication middleware

#### Issue #5: BarentsWatch Data Visible Only in Admin
- **Problem**: Outbreak data fetched but not shown anywhere meaningful
- **Impact**: Most important data (disease outbreaks) hidden in admin dashboard
- **Root Cause**: No integration into farmer/vessel risk scoring
- **Status**: 🟡 MEDIUM - AdminMVP works, but doesn't affect other MVPs

---

## 📋 What Needs to Be Built

### Tier 1: Critical (Blocks other features)
1. **User Service**
   - [ ] Create `/api/users/me` - Get current authenticated user
   - [ ] Update frontend to fetch current user from backend
   - [ ] Update MOCK_USERS to pull from backend
   - Impact: Fix authentication data flow

2. **Data Filtering by User**
   - [ ] `/api/mvp/farmer?userId=user_1` - Filter by user
   - [ ] `/api/mvp/vessel?userId=user_3` - Filter by user
   - [ ] `/api/mvp/fisher?userId=user_5` - Filter by user
   - Impact: Show only user's own facilities

3. **Frontend Real Data Integration**
   - [ ] FarmerMVP: Fetch farms from `/api/mvp/farmer`
   - [ ] VesselMVP: Fetch vessels from `/api/mvp/vessel`
   - [ ] FisherDashboard: Already working ✅
   - Impact: Show real data instead of mock

### Tier 2: Important (Improves usability)
1. **Risk Scoring**
   - [ ] Calculate farm risk based on BarentsWatch outbreaks
   - [ ] Update `/api/mvp/farm/:id/disease-risks` to use ML model
   - [ ] Show risk in FarmerMVP dashboard
   - Impact: Prioritize high-risk facilities

2. **Alert Integration**
   - [ ] Show `/api/mvp/admin/alerts` in FarmerMVP
   - [ ] Show facility-specific alerts
   - [ ] Push notifications when risk increases
   - Impact: Immediate visibility of threats

3. **User Preferences**
   - [ ] Store user's selected facilities
   - [ ] Remember dashboard preferences
   - [ ] Save notification settings
   - Impact: Better UX

### Tier 3: Nice to Have
1. **Export/Report Generation** - `/api/export/report`
2. **Search Across Facilities** - `/api/search`
3. **Batch Operations** - `/api/mvp/vessel/batch-task`
4. **Historical Charts** - `/api/stats/facility-trends`

---

## 🎯 Recommended Next Steps

### Phase 1 (1-2 hours): Get Real Data Flowing
1. ✅ Create JWT middleware in backend (check if exists)
2. ✅ Create `/api/users/me` endpoint
3. ✅ Update FarmerMVP to fetch real farms
4. ✅ Update VesselMVP to fetch real vessels
5. ✅ Test data filters by userId

**Result**: See 100 farms, 8 vessels in frontned instead of mock data

### Phase 2 (1-2 hours): Add Risk Scoring
1. ✅ Integrate BarentsWatch outbreaks into risk calculation
2. ✅ Update `/api/mvp/farm/:id/disease-risks` 
3. ✅ Show ML risk scores in FarmerMVP
4. ✅ Color-code by risk level

**Result**: Farmers see which facilities are at risk

### Phase 3 (1-2 hours): Real-time Alerts
1. ✅ Fetch active alerts in FarmerMVP
2. ✅ Show facility-specific warnings
3. ✅ Add sound/visual notification
4. ✅ Acknowledge/resolve workflow

**Result**: Users notified of threats immediately

---

## 📌 Key Questions to Resolve

1. **Authentication**
   - Should we use JWT tokens or simple session?
   - Where are valid userIds stored (database or hardcoded)?
   - How do we pass auth to API? (Header? Cookie?)

2. **Data Persistence**
   - Are API responses currently being cached?
   - Should frontend store data in localStorage or always fetch fresh?
   - How often should data refresh? (Immediate? Every 5 min? Once per day?)

3. **Multi-User Data**
   - Should farmers see all 100 farms or just their own?
   - Can one user own multiple farms?
   - How to handle shared facilities (multiple users per farm)?

4. **Risk Calculation**
   - Should BarentsWatch outbreaks trigger automatic ML predictions?
   - Who sees the risk scores (admins only, or all users)?
   - How often recalculate? (Real-time, hourly, daily?)

---

## 💡 Bottom Line

**The backend is 80% complete with all APIs.**  
**The frontend is only 30% connected to the backend.**

Most features just need frontend-backend integration, not new code.

**Priority**: Get real data flowing → users will see their actual facilities and real disease risks.

