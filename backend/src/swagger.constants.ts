// Pinned to the installed swagger-ui-dist version (see package.json) so the
// CDN assets always match what @nestjs/swagger generated the API doc for.
export const SWAGGER_UI_VERSION = '5.32.13';
export const SWAGGER_UI_CDN_ORIGIN = 'https://cdn.jsdelivr.net';
export const SWAGGER_UI_CDN_BASE = `${SWAGGER_UI_CDN_ORIGIN}/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;
