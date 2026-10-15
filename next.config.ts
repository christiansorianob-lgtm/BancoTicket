import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Casi todas las páginas dependen de la sesión: sin Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
