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
      {
        protocol: "https",
        hostname: "reconexion-api-images-147455119818.s3.us-east-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
