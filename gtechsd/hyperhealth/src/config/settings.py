"""
Configuration settings for HyperHealth application.
"""

# ----------------------------------------------------------------------
# Feature Flags
# ----------------------------------------------------------------------
PHONE_SYSTEM_ENABLED = True  # Enable automated phone system module
RECORDS_STORAGE_PATH = "data/records"  # Default directory for encrypted patient records

# ----------------------------------------------------------------------
# Security Settings
# ----------------------------------------------------------------------
AES_GCM_KEY_SIZE = 32  # 256‑bit key
PBKDF2_ITERATIONS = 100_000
MASTER_KEY_ROTATION_DAYS = 90  # Rotate master key quarterly

# ----------------------------------------------------------------------
# API Endpoints (placeholder)
# ----------------------------------------------------------------------
API_BASE_URL = "https://api.hyperhealth.local"
PHONE_API_ENDPOINT = f"{API_BASE_URL}/phone"
RECORDS_API_ENDPOINT = f"{API_BASE_URL}/records"

# ----------------------------------------------------------------------
# Miscellaneous
# ----------------------------------------------------------------------
DEBUG_MODE = False  # Set to True for development debugging