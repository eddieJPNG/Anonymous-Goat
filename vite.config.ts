import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { walletStubViteAliases } from "@caatinga/client/vite";
import { fileURLToPath } from "node:url";

const stubsDir = fileURLToPath(new URL("./src/stubs", import.meta.url));

function templateManualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }
  if (id.includes("@stellar/stellar-sdk")) {
    return "stellar-sdk";
  }
  if (id.includes("@creit.tech/stellar-wallets-kit")) {
    return "wallet-kit";
  }
  if (id.includes("@caatinga/zk")) {
    return "caatinga-zk";
  }
  if (id.includes("react-dom") || id.includes("/react/")) {
    return "react-vendor";
  }
  return undefined;
}

// `.wasm` and `.zkey` are consumed by snarkjs in the browser through `fetch()`
// + `WebAssembly.compile`, so they must arrive as bytes. Decoding them as UTF-8
// corrupts the payload (and `application/json` makes the browser reject the
// response), which surfaces later as a baffling witness-calculation failure.
const BINARY_ARTIFACT_TYPES: Record<string, string> = {
  ".wasm": "application/wasm",
  ".zkey": "application/octet-stream",
  ".r1cs": "application/octet-stream",
  ".wtns": "application/octet-stream",
  ".ptau": "application/octet-stream",
};

function zkArtifactsPlugin(): Plugin {
  const artifactsDir = path.resolve(process.cwd(), ".artifacts/zk/main");

  const serveArtifacts = (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader(name: string, value: string): void;
      end(chunk?: Buffer | string): void;
    },
    next: () => void
  ) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const relativePath = urlPath.replace(/^\/+/, "");
    if (!relativePath || relativePath.includes("..")) {
      next();
      return;
    }

    const filePath = path.join(artifactsDir, relativePath);
    if (!filePath.startsWith(artifactsDir)) {
      res.statusCode = 403;
      res.end();
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.statusCode = 404;
        res.end();
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      // Only `.json` is text; everything else (`.wasm`, `.zkey`, `.sym`, …) is
      // sent as raw bytes so `fetch().arrayBuffer()` gets an uncorrupted file.
      const contentType =
        ext === ".json"
          ? "application/json; charset=utf-8"
          : (BINARY_ARTIFACT_TYPES[ext] ?? "application/octet-stream");
      res.setHeader("Content-Type", contentType);
      res.end(contentType.startsWith("application/json") ? data.toString("utf8") : data);
    });
  };

  return {
    name: "caatinga-zk-artifacts",
    configureServer(server) {
      server.middlewares.use("/zk-artifacts", serveArtifacts);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/zk-artifacts", serveArtifacts);
    },
  };
}

export default defineConfig({
  plugins: [react(), zkArtifactsPlugin()],
  server: {
    fs: {
      allow: ["..", ".artifacts"],
    },
  },
  resolve: {
    alias: walletStubViteAliases(stubsDir),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: templateManualChunks,
      },
    },
  },
});
