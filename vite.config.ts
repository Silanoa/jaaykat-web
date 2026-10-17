import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Jaaykat",
        short_name: "Jaaykat",
        start_url: "/app",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "fr",
        background_color: "#FAF7F2",
        theme_color: "#0B6E4F",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/webhooks": "http://localhost:3000",
    },
  },
});
