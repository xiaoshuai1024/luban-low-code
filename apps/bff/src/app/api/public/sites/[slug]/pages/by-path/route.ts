import { GET as getPublishedPage } from "../route";

/**
 * Backward-compatible route:
 * GET /api/public/sites/:slug/pages/by-path?path=...
 */
export const GET = getPublishedPage;
