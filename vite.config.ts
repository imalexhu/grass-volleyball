import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
export default defineConfig({
  // Disable the default Cloudflare build
  cloudflare: false,
  // Pass the Nitro plugin to Vite
  vite: {
    plugins: [nitro()]
  }
});