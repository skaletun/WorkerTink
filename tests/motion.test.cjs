const fs = require("node:fs");
const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync("src/ui.css", "utf8") + fs.readdirSync("src/styles").filter(file => file.endsWith(".css")).map(file => fs.readFileSync(`src/styles/${file}`, "utf8")).join("\n");
for (const token of ["BootScreen", "tab-stage", "shift-modal", "prefers-reduced-motion"]) {
  if (!app.includes(token) && !css.includes(token)) throw new Error(`Missing motion token: ${token}`);
}
if (!css.includes("@keyframes wt-page-in")) throw new Error("Missing tab transition keyframes");
if (!css.includes("@keyframes wt-modal-in")) throw new Error("Missing modal transition keyframes");
console.log("WorkerTink motion tests: OK");
