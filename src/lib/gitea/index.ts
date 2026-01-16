/**
 * Gitea Integration Module
 *
 * Provides configuration management and utilities for the bundled Gitea
 * git server that comes with the all-in-one container.
 *
 * Gitea is pre-configured and enabled by default on http://localhost:8929
 */

// Re-export all configuration utilities
export {
  // Types
  type GiteaConfig,
  type GiteaConnectionStatus,

  // Constants
  DEFAULT_GITEA_URL,

  // Default config
  createDefaultGiteaConfig,

  // CRUD operations
  getGiteaConfig,
  saveGiteaConfig,
  updateGiteaConfig,
  deleteGiteaConfig,

  // Helpers
  isGiteaConfigured,
  getGiteaUrl,
  subscribeToGiteaConfig,

  // URL utilities
  validateGiteaUrl,
  buildGiteaApiUrl,
  buildIframeUrl,
} from "./config"
