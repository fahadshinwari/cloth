/**
 * CDP-driven merchant flow with session diagnostics.
 * Usage: node scripts/verify-merchant-flow.mjs [port] [slug] [email] [password]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import WebSocket from "ws";

const port = process.argv[2] || "3001";
const slug = process.argv[3] || "";
const email = process.argv[4] || "";
const password = process.argv[5] || "";
const base = `http://localhost:${port}`;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = `${process.env.TEMP ?? "/tmp"}\\chrome-merchant2-${Date.now()}`;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  `--user-data-dir=${userDataDir}`,
  "--remote-debugging-port=9225",
  "about:blank",
]);
await wait(2500);

const targets = await (await fetch("http://localhost:9225/json")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on("open", r));

let id = 0;
const pending = new Map();
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    id += 1; pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expr) {
  const res = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return res.result?.result?.value;
}

const results = { steps: [] };
function log(step, ok, detail = "") {
  results.steps.push({ step, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${step}${detail ? " — " + detail : ""}`);
}

await send("Page.enable");
await send("Runtime.enable");

// 1. Shop login page renders
await send("Page.navigate", { url: `${base}/${slug}/login` });
await wait(2500);
const pageText = await evaluate("document.body.innerText.slice(0, 200)");
log("shop login page renders", (pageText || "").length > 0, JSON.stringify((pageText || "").slice(0, 60)));

// 2. Login as merchant admin with diagnostics
const login = await evaluate(`(async () => {
  const form = document.querySelector('form');
  const email = form?.querySelector('input[name=email]');
  const pass = form?.querySelector('input[name=password]');
  if (!email || !pass) return { ok: false, reason: 'missing inputs' };
  email.value = ${JSON.stringify(email)};
  pass.value = ${JSON.stringify(password)};
  form.requestSubmit();
  await new Promise(r => setTimeout(r, 8000));
  const cookies = document.cookie;
  return { ok: true, url: location.pathname, hasSessionCookie: cookies.length > 0 ? 'client-visible-cookies-present' : 'none (httpOnly not visible to JS)' };
})()`);
log("merchant login submit", login?.ok === true, JSON.stringify(login));

// 2b. Diagnostics: check with Network.getCookies (includes httpOnly)
const diag = await send("Network.getCookies", { urls: [base] });
const cookieNames = diag.result?.cookies?.map((c) => c.name) ?? [];
console.log("cookies after login:", cookieNames.join(", ") || "(none)");

const hasSession = cookieNames.includes("ws_session");
log("session cookie exists after login", hasSession, cookieNames.join(", "));

if (!hasSession) {
  // Server-side session was established but client lost it — check final URL
  const finalUrl = await evaluate("location.href");
  console.log("final URL:", finalUrl);
  const bodyText = await evaluate("document.body.innerText.slice(0, 300)");
  console.log("body text:", JSON.stringify(bodyText));
  process.exit(1);
}

// 3. Dashboard content
await send("Page.navigate", { url: `${base}/${slug}/dashboard` });
await wait(4000);
const dash = await evaluate("document.body.innerText.slice(0, 400)");
log("dashboard shows tenant info", (dash || "").includes("/" + slug), (dash || "").slice(0, 100).replace(/\n/g, " | "));

// 4. Cross-tenant protection
await send("Page.navigate", { url: `${base}/some-other-shop/dashboard` });
await wait(4000);
const bouncedPath = await evaluate("location.pathname");
log("cross-tenant access bounced to own dashboard", bouncedPath === `/${slug}/dashboard`, `path=${bouncedPath}`);

// 5. Settings page
await send("Page.navigate", { catch: true, url: `${base}/${slug}/settings` });
await wait(3000);
const settings = await evaluate("document.body.innerText.slice(0, 300)");
log("settings page renders", (settings || "").length > 0, "");

// 6. RTL check with Dari
await evaluate(`document.cookie = 'ws_locale=fa-AF; path=/; max-age=31536000'`);
await send("Page.navigate", { url: `${base}/${slug}/dashboard` });
await wait(3000);
const dir = await evaluate("document.documentElement.getAttribute('dir')");
const lang = await evaluate("document.documentElement.getAttribute('lang')");
log("Dari locale applies RTL", dir === "rtl", `dir=${dir} lang=${lang}`);
await evaluate(`document.cookie = 'ws_locale=en; path=/; max-age=31536000'`);

ws.close();
chrome.kill();
fs.writeFileSync(`${process.env.TEMP ?? "/tmp"}/merchant-flow-result.json`, JSON.stringify(results, null, 2));
process.exit(results.steps.every((s) => s.ok) ? 0 : 1);
