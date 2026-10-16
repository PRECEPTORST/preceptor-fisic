import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import devServer from "@hono/vite-dev-server";
import path from "path";

const repo = path.resolve(__dirname, "..");

export default defineConfig(({ mode }) => {
  // A API em dev lê as mesmas chaves do SvelteKit (../.env.local).
  Object.assign(process.env, loadEnv(mode, repo, ""));
  return {
    // VITE_* do front também moram no .env da raiz do repo.
    envDir: repo,
    envPrefix: ["VITE_", "PUBLIC_"],
    server: { port: 5174 },
    plugins: [
      react(),
      devServer({ entry: "server/dev.ts", exclude: [/^(?!\/api\/).*/] }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        $lib: path.resolve(repo, "src/lib"),
        "$env/dynamic/private": path.resolve(__dirname, "server/shims/env-private.ts"),
        "$env/dynamic/public": path.resolve(__dirname, "server/shims/env-public.ts"),
        "$app/environment": path.resolve(__dirname, "server/shims/app-environment.ts"),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-query"],
    },
  };
});
