import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "venezuelatebusca.com",
      },
      {
        protocol: "https",
        hostname: "cdn-imagenes.theempire.tech",
      },
      {
        protocol: "https",
        hostname: "wlvcfbuxkdrxhxqlwwmo.supabase.co",
      },
      {
        protocol: "https",
        hostname: "911.ubica.me",
      },
    ],
  },
};

export default nextConfig;
