import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Separate output for `next dev`, so a running dev server can't mix files into a production build
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;

// Makes Cloudflare bindings available during local development with `next dev`.
// Remote bindings (Workers AI) are skipped so local work doesn't need a Cloudflare login;
// the daily summary falls back to a template without AI.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({ remoteBindings: false });
}
