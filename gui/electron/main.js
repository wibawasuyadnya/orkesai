// Electron shell for the OrkesAI GUI.
//
// Packaged (.dmg):  serves the static Next.js export bundled inside the app
//                   (out/) on a random localhost port and loads that, and
//                   spawns the Python API server on :8765 from
//                   ~/.config/orkesai if it isn't already running.
// Dev (default):    loads http://127.0.0.1:3000 (next dev) — `npm run app`.
// Remote (VPS):     AI_GUI_URL=http://your-vps npm run electron
//                   — no local server is spawned; if the VPS is behind
//                   Caddy basic auth, set AI_GUI_USER / AI_GUI_PASS too.
const { app, BrowserWindow, Menu } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

// Name the app so the macOS menu bar shows "OrkesAI" (not "Electron") and the
// About panel / dock use the right name — even when running `npm run app`.
app.setName("OrkesAI");

const GUI_URL = process.env.AI_GUI_URL || "http://127.0.0.1:3000";
const IS_LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(GUI_URL + "/");
const API_URL = "http://127.0.0.1:8765/api/health";
const SERVER = path.join(os.homedir(), ".config", "orkesai", "server", "server.py");
const UI_DIR = path.join(__dirname, "..", "out"); // static export, inside app.asar
// orkesai.icns is used when packaging; the png sets the dev dock/window icon
const ICON_PNG = path.join(__dirname, "..", "assets", "orkesai-icon.png");
// macOS never rounds icons for you — the dock artwork carries its own
// rounded-rect shape with transparent margins
const DOCK_PNG = path.join(__dirname, "..", "assets", "orkesai-dock.png");

let serverProc = null;

function ping(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(res.statusCode === 200)).on("error", () => resolve(false));
  });
}

// ── self-contained install ───────────────────────────────────────────────────
// The packaged app carries the whole engine in Resources/: `payload/` (server
// + modules + default agents + .env template) and `python/` (a standalone
// CPython). First launch seeds ~/.config/orkesai from the payload; an app
// update refreshes ENGINE code only — user data (.env, agents.json, sessions,
// notes, automations, groups) is never touched. The terminal CLI is a separate
// install and not part of the app.
const CFG_DIR = path.join(os.homedir(), ".config", "orkesai");
const PAYLOAD = path.join(process.resourcesPath || "", "payload");
const BUNDLED_PY = process.platform === "win32"
  ? path.join(process.resourcesPath || "", "python", "python.exe")
  : path.join(process.resourcesPath || "", "python", "bin", "python3");

function ensureConfig() {
  if (!app.isPackaged || !fs.existsSync(PAYLOAD)) return;
  try {
    // a dev machine symlinks ~/.config/orkesai to the git repo — leave it alone
    if (fs.existsSync(CFG_DIR) && fs.lstatSync(CFG_DIR).isSymbolicLink()) return;
    const stamp = path.join(CFG_DIR, ".app-version");
    const cur = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8").trim() : "";
    if (cur === app.getVersion() && fs.existsSync(path.join(CFG_DIR, "server", "server.py"))) return;
    fs.mkdirSync(CFG_DIR, { recursive: true });
    for (const dir of ["server", "modules"]) {
      fs.cpSync(path.join(PAYLOAD, dir), path.join(CFG_DIR, dir), { recursive: true, force: true });
    }
    if (!fs.existsSync(path.join(CFG_DIR, "agents.json"))) {
      fs.copyFileSync(path.join(PAYLOAD, "agents.json"), path.join(CFG_DIR, "agents.json"));
    }
    if (!fs.existsSync(path.join(CFG_DIR, ".env"))) {
      fs.copyFileSync(path.join(PAYLOAD, ".env.example"), path.join(CFG_DIR, ".env"));
    }
    fs.writeFileSync(stamp, app.getVersion());
  } catch (err) {
    console.error("[orkesai] config bootstrap failed:", err.message);
  }
}

// Finder/Dock apps get the bare launchd PATH, so the server would never find
// the user's `claude` / `codex` CLIs (Homebrew, npm, nvm…). Ask the login
// shell for the real PATH once and hand it to the server.
function serverEnv() {
  const env = { ...process.env };
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const p = require("child_process")
      .execSync(`${shell} -ilc 'echo -n "$PATH"'`, { timeout: 5000 })
      .toString().trim();
    if (p) env.PATH = p;
  } catch {
    // no login shell (or it hung) — at least add the common install dirs
    env.PATH = [env.PATH, "/opt/homebrew/bin", "/usr/local/bin",
                path.join(os.homedir(), ".local", "bin")].filter(Boolean).join(":");
  }
  return env;
}

function pythonBin() {
  if (fs.existsSync(BUNDLED_PY)) {
    // unsigned distribution: clear the quarantine bit once so macOS lets the
    // embedded interpreter run after the user approved the app itself
    if (process.platform === "darwin") {
      try {
        require("child_process").execFileSync("/usr/bin/xattr",
          ["-dr", "com.apple.quarantine", path.join(process.resourcesPath, "python")]);
      } catch { /* already clean or xattr unavailable */ }
    }
    return BUNDLED_PY;
  }
  return process.platform === "win32" ? "python" : "python3";
}

async function ensureServer() {
  if (await ping(API_URL)) return;
  ensureConfig();
  serverProc = spawn(pythonBin(), [SERVER], { stdio: "inherit", env: serverEnv() });
  // A missing engine must not crash the app — the UI shows its own
  // "server unreachable" state.
  serverProc.on("error", (err) => {
    console.error("[orkesai] could not start the API server:", err.message);
    serverProc = null;
  });
  for (let i = 0; i < 20; i++) {
    if (await ping(API_URL)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

// Packaged mode: the exported UI lives inside the app bundle (app.asar).
// file:// breaks Next's absolute /_next asset paths, so serve out/ over a
// tiny localhost HTTP server on a random free port instead.
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
};

function serveUi() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      let file = path.normalize(path.join(UI_DIR, p));
      if (!file.startsWith(UI_DIR)) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
      fs.readFile(file, (err, data) => {
        if (err) {
          // SPA fallback: unknown paths get the root page
          fs.readFile(path.join(UI_DIR, "index.html"), (e2, home) => {
            if (e2) { res.writeHead(404); return res.end("not found"); }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(home);
          });
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${srv.address().port}/`));
  });
}

async function createWindow() {
  if (IS_LOCAL) await ensureServer();
  if (process.platform === "darwin" && app.dock) {
    try { app.dock.setIcon(DOCK_PNG); } catch {}
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 720,
    backgroundColor: "#131519",
    titleBarStyle: "hiddenInset",
    // Nudge the traffic lights down so they sit centered in the sidebar's
    // top strip instead of crowding the toolbar
    trafficLightPosition: { x: 14, y: 18 },
    icon: ICON_PNG,
    webPreferences: { contextIsolation: true },
  });
  // Links (target="_blank" / window.open) open in the user's real browser,
  // not a new Electron window
  const { shell } = require("electron");
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  // Also catch same-window navigations to external URLs
  win.webContents.on("will-navigate", (e, url) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(GUI_URL)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Installed app (no AI_GUI_URL override): use the bundled UI
  if (app.isPackaged && !process.env.AI_GUI_URL && fs.existsSync(UI_DIR)) {
    win.loadURL(await serveUi());
  } else {
    win.loadURL(GUI_URL);
  }
}

// Answer Caddy's basic-auth challenge when credentials are provided
app.on("login", (event, _wc, _details, _authInfo, callback) => {
  if (process.env.AI_GUI_USER) {
    event.preventDefault();
    callback(process.env.AI_GUI_USER, process.env.AI_GUI_PASS || "");
  }
});

// A proper application menu so the first (app) menu reads "OrkesAI" on macOS
function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "OrkesAI on GitHub",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://github.com/wibawasuyadnya/orkesai");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (serverProc) serverProc.kill();
  app.quit();
});
