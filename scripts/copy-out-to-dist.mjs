import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

if (!existsSync("out")) {
  throw new Error("Expected Next static export output directory: out");
}

await rm("dist", { recursive: true, force: true });
await cp("out", "dist", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile(
  "dist/server/index.js",
  `
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url);
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

async function serve(pathname) {
  const safePath = normalize(pathname).replace(/^(\\.\\.[/\\\\])+/, "");
  const filePath = join(root.pathname, safePath === "/" ? "index.html" : safePath);
  const body = await readFile(filePath);
  return new Response(body, {
    headers: {
      "content-type": types[extname(filePath)] ?? "application/octet-stream"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    try {
      return await serve(url.pathname);
    } catch {
      try {
        return await serve("/404.html");
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }
  }
};
`.trimStart(),
);
