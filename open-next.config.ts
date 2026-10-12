import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: all pages are rendered on demand and upstream responses are cached via fetch headers.
// To enable Next.js caching later, see https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
