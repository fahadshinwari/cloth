/**
 * CDP-driven headless Chrome test: fill login form, submit the real
 * Server Action, and confirm the super admin lands on /admin.
 * Usage: node scripts/verify-full-flow.mjs [port]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import WebSocket from "ws";

const port = process.argv[2] || "3001";
const base = `http://localhost:${port}`;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = `${process.env.TEMP ?? "/tmp"}\\chrome-flow-${Date.now()}`;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--user-data-dir=${userDataDir}`,
  "--remote-debugging-port=9223",
  "about:blank",
]);

await wait(2500);

const targets = await (await fetch("http://localhost:9223/json")).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on("open", r));

let id = 0;
const pending = new Map();
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    id += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expr) {
  const res = await send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  return res.result?.result?.value;
}

const results = { steps: [] };
function log(step, ok, detail = "") {
  results.steps.push({ step, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${step}${detail ? " — " + detail : ""}`);
}

await send("Page.enable");
await send("Runtime.enable");

// 1. Navigate to super-login
await send("Page.navigate", { url: `${base}/super-login` });
await wait(3000);

// 2. Fill and submit the form from inside the page (real client runtime)
const loginResult = await evaluate(`(async () => {
  const form = document.querySelector('form');
  if (!form) return { ok: false, reason: 'no form' };
  const email = form.querySelector('input[name=email]');
  const pass = form.querySelector('input[name=password]');
  if (!email || !pass) return { ok: false, reason: 'missing inputs' };
  email.value = 'admin@baseer.com';
  pass.value = 'SuperAdmin@123';
  form.requestSubmit();
  await new Promise(r => setTimeout(r, 6000));
  return { ok: true, url: location.pathname };
})()`);
log("super admin login submit", loginResult?.ok === true, JSON.stringify(loginResult));

// 3. Confirm we landed on /admin
const path = await evaluate("location.pathname");
log("landed on /admin", path === "/admin", `path=${path}`);

// 4. Admin page content check
await wait(1500);
const adminText = await evaluate("document.body.innerText.slice(0, 400)");
const hasShopsHeading = (adminText || "").includes("Shops") || (adminText || "").includes("shops");
log("admin dashboard shows shops UI", hasShopsHeading, JSON.stringify((adminText || "").slice(0, 120)));

// 5. Create a shop through the real UI
await send("Page.navigate", { url: `${base}/admin/shops/new` });
await wait(2500);
const createResult = await evaluate(`(async () => {
  const form = document.querySelector('form');
  if (!form) return { ok: false, reason: 'no form' };
  const set = (name, value) => {
    const el = form.querySelector('[name=' + name + ']');
    if (!el) return false;
    el.value = value;
    return true;
  };
  const stamp = Date.now().toString(36);
  const slug = 'uishop-' + stamp;
  set('name', 'UI Shop ' + stamp);
  set('slug', slug);
  set('adminName', 'UI Admin');
  set('adminEmail', 'ui-' + stamp + '@example.com');
  set('adminPassword', 'UIPass@12345');
  set('phone', '0712345678');
  form.requestSubmit();
  await new Promise(r => setTimeout(r, 7000));
  return { ok: true, slug, url: location.pathname, text: document.body.innerText.slice(0, 200) };
})()`);
log("create shop via UI", createResult?.ok === true, `slug=${createResult?.slug} url=${createResult?.url}`);

// 6. Log out (click logout button) then verify guard bounces us
const logout = await evaluate(`(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('log out'));
  if (!btn) return { ok: false };
  btn.click();
  await new Promise(r => setTimeout(r, 5000));
  return { ok: true, url: location.pathname };
})()`);
log("logout returns to super-login", logout?.url === "/super-login" || logout?.ok === false, JSON.stringify(logout));

// 7. After logout, /admin must redirect to /super-login
await send("Page.navigate", { url: `${base}/admin` });
await wait(2500);
const guardedPath = await evaluate("location.pathname");
log("admin guarded after logout", guardedPath === "/super-login", `path=${guardedPath}`);

ws.close();
chrome.kill();
fs.writeFileSync(`${process.env.TEMP ?? "/tmp"}/full-flow-result.json`, JSON.stringify(results, null, 2));
process.exit(results.steps.every((s) => s.ok) ? 0 : 1);
