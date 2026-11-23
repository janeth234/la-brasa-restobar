import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo (npm run dev) las llamadas /api van al servidor de npm start (puerto 3000)
export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy: { "/api": "http://localhost:3000" } },
});
