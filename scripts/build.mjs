// Zero-dependency build: type-check + emit ES modules with tsc, then copy static files.
import { execSync } from "node:child_process";
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
execSync("npx --no-install tsc -p tsconfig.json || tsc -p tsconfig.json", { stdio: "inherit", shell: true });
if (existsSync("public")) cpSync("public", "dist", { recursive: true });
console.log("build ok → dist/");
