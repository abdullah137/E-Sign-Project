import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join("node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const target = join("public", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied PDF.js worker to ${target}`);
