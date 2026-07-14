import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

if (!existsSync("out")) {
  throw new Error("Expected Next static export output directory: out");
}

await rm("dist", { recursive: true, force: true });
await cp("out", "dist", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

const assets = [];
for (const file of await collectFiles("out")) {
  const route = `/${relative("out", file).split(sep).join("/")}`;
  const body = await readFile(file);
  assets.push([route, types[extname(file)] ?? "application/octet-stream", body.toString("base64")]);
}

await writeFile(
  "dist/server/index.js",
  `
const assets = new Map(${JSON.stringify(assets)});

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function responseFor(pathname) {
  const normalized = pathname.endsWith("/") ? pathname + "index.html" : pathname;
  const asset = assets.get(normalized) ?? assets.get(pathname) ?? assets.get("/index.html");
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(decode(asset[2]), {
    headers: {
      "content-type": asset[1],
      "cache-control": normalized.includes("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    return responseFor(url.pathname);
  }
};
`.trimStart(),
);
