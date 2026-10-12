import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Makes Cloudflare bindings available during local development with `next dev`
initOpenNextCloudflareForDev();
