import type { NextConfig } from "next";

// Cache Components is deliberately off: pages here are either fully static
// (library guides) or fully dynamic (live-generated guides), so the classic
// caching model is simpler and avoids Suspense-boundary build errors.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Guide JSON is read from disk at runtime; make sure it ships with the functions.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
};

export default nextConfig;
