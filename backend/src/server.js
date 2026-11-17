import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname, sep } from "node:path";
import { createApplication } from "./application.js";
import { command } from "./commands.js";

const frontend = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
async function readBody(request) {
  let size = 0,
    chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 3_000_000) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("INVALID_JSON");
  return body;
}
export function createHttpServer(initialApp = createApplication()) {
  let app = initialApp;
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/state") {
        const month = url.searchParams.get("month") || undefined;
        if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
          return json(response, 400, { reason: "INVALID_MONTH" });
        return json(response, 200, await app.snapshot(month));
      }
      if (request.method === "POST" && url.pathname === "/api/command") {
        // Reject cross-origin mutations; this local demo intentionally has no login.
        const origin = request.headers.origin;
        if (
          origin &&
          ![
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://localhost:5173",
          ].includes(origin)
        )
          return json(response, 403, { reason: "INVALID_ORIGIN" });
        const body = await readBody(request);
        if (body.action === "reset") {
          app = createApplication();
          return json(response, 200, { ok: true });
        }
        const result = await command(app, body);
        return json(response, result.ok ? 200 : 400, result);
      }
      if (url.pathname.startsWith("/api/"))
        return json(response, 404, { reason: "NOT_FOUND" });
      if (request.method !== "GET")
        return json(response, 405, { reason: "METHOD_NOT_ALLOWED" });
      const path = resolve(
        frontend,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!path.startsWith(frontend.endsWith(sep) ? frontend : frontend + sep))
        return json(response, 404, { reason: "NOT_FOUND" });
      try {
        const contents = await readFile(path);
        response.writeHead(200, {
          "Content-Type": types[extname(path)] || "application/octet-stream",
        });
        response.end(contents);
      } catch {
        json(response, 404, { reason: "Run npm run build first, then open /" });
      }
    } catch (error) {
      const badRequest =
        error instanceof SyntaxError ||
        ["BODY_TOO_LARGE", "INVALID_JSON"].includes(error.message);
      json(response, badRequest ? 400 : 500, {
        ok: false,
        reason: badRequest ? "INVALID_REQUEST" : "SERVER_ERROR",
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createHttpServer();
  server.listen(Number(process.env.PORT || 3000), "127.0.0.1", () =>
    console.log("Snack Counter: http://127.0.0.1:" + server.address().port),
  );
}
