#!/usr/bin/env python3
"""
Download ocean current data from Copernicus Marine Service.

This script downloads ocean current data (velocity components) from the 
Copernicus Marine global ocean physics analysis and forecast dataset.

Requirements:
- copernicusmarine: pip install copernicusmarine
- Copernicus Marine credentials in environment variables or .env file

Usage:
    python download_copernicus.py
    
    Or with custom parameters:
    python download_copernicus.py --start-date 2026-01-16 --end-date 2026-01-17
"""

import os
import argparse
from pathlib import Path
from datetime import datetime, timedelta
import logging

try:
    import copernicusmarine
except ImportError:
    print("❌ copernicusmarine not installed. Install with: pip install copernicusmarine")
    exit(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BARENTSHAVET_CONFIG = {
    "min_longitude": 10.0,
    "max_longitude": 35.0,
    "min_latitude": 70.0,
    "max_latitude": 82.0,
    "min_depth": 0.0,
    "max_depth": 100.0,
}

DATASET_ID = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
VARIABLES = ["uo", "vo"]  # Eastward and northward sea water velocity


def load_credentials():
    """Load Copernicus credentials from environment or .env file."""
    # Try loading from .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        logger.warning("python-dotenv not installed, using environment variables only")
    
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")
    
    if not username or not password:
        raise ValueError(
            "❌ Copernicus credentials not found.\n"
            "Set COPERNICUS_USERNAME and COPERNICUS_PASSWORD environment variables\n"
            "or add them to .env file"
        )
    
    return username, password


def download_ocean_data(
    start_date: str,
    end_date: str,
    output_dir: str = "copernicus_data",
    region: dict = None,
) -> str:
    """
    Download ocean current data from Copernicus Marine.
    
    Args:
        start_date: Start date in format YYYY-MM-DD
        end_date: End date in format YYYY-MM-DD
        output_dir: Output directory for downloaded files
        region: Dictionary with min/max longitude/latitude/depth
        
    Returns:
        Path to downloaded file
    """
    
    if region is None:
        region = BARENTSHAVET_CONFIG
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Generate output filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"barentshavet_currents_{timestamp}.nc"
    
    logger.info("=" * 60)
    logger.info("COPERNICUS MARINE DATA DOWNLOAD")
    logger.info("=" * 60)
    logger.info(f"Dataset: {DATASET_ID}")
    logger.info(f"Variables: {', '.join(VARIABLES)}")
    logger.info(f"Date range: {start_date} to {end_date}")
    logger.info(f"Region: Barentshavet")
    logger.info(f"  Longitude: {region['min_longitude']}°E - {region['max_longitude']}°E")
    logger.info(f"  Latitude: {region['min_latitude']}°N - {region['max_latitude']}°N")
    logger.info(f"  Depth: {region['min_depth']}m - {region['max_depth']}m")
    logger.info(f"Output: {output_path / output_file}")
    logger.info("=" * 60)
    
    try:
        logger.info("🔐 Loading credentials...")
        username, password = load_credentials()
        logger.info("✅ Credentials loaded")
        
        logger.info("📥 Starting download...")
        
        # Download using subset function
        copernicusmarine.subset(
            dataset_id=DATASET_ID,
            variables=VARIABLES,
            minimum_longitude=region["min_longitude"],
            maximum_longitude=region["max_longitude"],
            minimum_latitude=region["min_latitude"],
            maximum_latitude=region["max_latitude"],
            minimum_depth=region["min_depth"],
            maximum_depth=region["max_depth"],
            start_datetime=start_date,
            end_datetime=end_date,
            output_directory=str(output_path),
            output_filename=output_file,
            username=username,
            password=password,
        )
        
        logger.info("=" * 60)
        logger.info("✅ DOWNLOAD COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        
        full_path = output_path / output_file
        logger.info(f"📁 File saved to: {full_path}")
        logger.info(f"📊 File size: {full_path.stat().st_size / (1024*1024):.2f} MB")
        
        return str(full_path)
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ ERROR DURING DOWNLOAD: {str(e)}")
        logger.error("=" * 60)
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Download ocean current data from Copernicus Marine"
    )
    
    # Default dates
    today = datetime.now()
    default_start = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    default_end = today.strftime("%Y-%m-%d")
    
    parser.add_argument(
        "--start-date",
        default=default_start,
        help=f"Start date (YYYY-MM-DD, default: {default_start})"
    )
    parser.add_argument(
        "--end-date",
        default=default_end,
        help=f"End date (YYYY-MM-DD, default: {default_end})"
    )
    parser.add_argument(
        "--output-dir",
        default="copernicus_data",
        help="Output directory (default: copernicus_data)"
    )
    
    args = parser.parse_args()
    
    try:
        download_ocean_data(
            start_date=args.start_date,
            end_date=args.end_date,
            output_dir=args.output_dir,
        )
    except Exception as e:
        logger.error(f"Failed to download: {e}")
        exit(1)


if __name__ == "__main__":
    main()
