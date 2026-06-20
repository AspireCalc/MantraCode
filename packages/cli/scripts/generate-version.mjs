import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const content = `export const MANTRACODE_VERSION = ${JSON.stringify(pkg.version)};\n`;

writeFileSync(resolve(__dirname, "../src/version.ts"), content);
console.log(`Generated src/version.ts with version ${pkg.version}`);
