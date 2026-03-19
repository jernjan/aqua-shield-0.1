import xarray as xr

# Åpne NetCDF-filen
NETCDF_PATH = r"c:/Users/janin/Downloads/cmems_mod_glo_phy_anfc_0.083deg_PT1H-m_1768880964826.nc"
ds = xr.open_dataset(NETCDF_PATH)

# Skriv ut variabler, dimensjoner og koordinater
print(ds)
print("Variables:", ds.variables.keys())
print("Dimensions:", ds.dims)
print("Coordinates:", ds.coords)
