import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";

// Runs after `react-router build` (see the build script). React Router generates the SPA index.html outside Vite's
// HTML pipeline, so no Vite CSP plugin can see it; this step hashes the inline bootstrap scripts it emits and
// injects the policy as a meta tag. A static header cannot carry the policy instead: the hashes change per build.
// frame-ancestors cannot live in a meta tag, so that one directive stays in vercel.json.

const sha256 = (content) => `'sha256-${createHash("sha256").update(content).digest("base64")}'`;

const file = new URL("../build/client/index.html", import.meta.url);
const html = readFileSync(file, "utf8");

const scriptHashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(([, body]) =>
    sha256(body),
);
if (scriptHashes.length === 0) throw new Error("No inline scripts found in index.html; the extraction regex is stale");

// Sonner injects its stylesheet as a runtime <style> element with no opt-out. Extract that exact CSS string from the
// installed package and allow it by hash, so style-src stays free of 'unsafe-inline' across sonner upgrades. The
// empty-string hash is needed because sonner appends the style element before filling it.
const sonnerSource = readFileSync(createRequire(import.meta.url).resolve("sonner"), "utf8");
const cssLiteral = sonnerSource.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)?.[1];
if (!cssLiteral) throw new Error("Could not extract sonner's runtime CSS; update the extraction in inject-csp.mjs");
const styleHashes = ["", new Function(`return ${cssLiteral}`)()].map(sha256);

const policy = [
    "default-src 'self'",
    // 'strict-dynamic' lets the hashed bootstrap scripts load our chunks and lets those chunks lazy-load PostHog
    // modules. CSP2 browsers ignore it and fall back to 'self' plus the hashes.
    `script-src 'self' 'strict-dynamic' ${scriptHashes.join(" ")}`,
    `style-src 'self' ${styleHashes.join(" ")}`,
    "img-src 'self' data:",
    "font-src 'self'",
    // The api is cross-origin by design. The build inlines VITE_API_URL into the bundle, so the policy derives the
    // allowed connect origin from the same variable; the fallback mirrors the dev default in @repo/env/web.
    `connect-src 'self' ${new URL(process.env.VITE_API_URL ?? "http://localhost:3001").origin}`,
    // PostHog session replay compresses recordings in a blob worker.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
].join("; ");

if (policy.includes("'unsafe-inline'") || /(^|[\s;])\*/.test(policy)) {
    throw new Error("Generated CSP contains 'unsafe-inline' or a wildcard");
}

writeFileSync(file, html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));
process.stdout.write(`CSP injected: ${scriptHashes.length} script hashes, ${styleHashes.length} style hashes\n`);
