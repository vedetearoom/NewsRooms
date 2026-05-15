import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const replacements = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_YW1hemVkLW1hcnN1cGlhbC0xMy5jbGVyay5hY2NvdW50cy5kZXYk",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "__AI_NEWSROOM_NEXT_PUBLIC_CLERK_SIGN_IN_URL__",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "__AI_NEWSROOM_NEXT_PUBLIC_CLERK_SIGN_UP_URL__",
  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: "__AI_NEWSROOM_NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL__",
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: "__AI_NEWSROOM_NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL__",
};

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [envKey, placeholder] of Object.entries(replacements)) {
    const value = process.env[envKey] || "";
    if (!content.includes(placeholder)) continue;
    content = content.split(placeholder).join(value);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
  }
}

function replaceRuntimePlaceholders(rootDir) {
  if (!fs.existsSync(rootDir)) return;

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      replaceRuntimePlaceholders(entryPath);
      continue;
    }
    if (/\.(js|json|html|txt)$/.test(entry.name)) {
      replaceInFile(entryPath);
    }
  }
}

replaceRuntimePlaceholders(".next");
replaceRuntimePlaceholders("server");

const child = spawn("node", ["server.js"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
