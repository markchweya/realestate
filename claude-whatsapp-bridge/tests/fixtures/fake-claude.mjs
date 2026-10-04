#!/usr/bin/env node
// Stand-in for the `claude` CLI: echoes its args/stdin and replays the fixture stream.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let stdin = "";
process.stdin.on("data", (d) => (stdin += d));
process.stdin.on("end", async () => {
  if (stdin.includes("HANG")) return setInterval(() => {}, 1000);
  if (stdin.includes("CRASH")) {
    process.stderr.write("Error: not logged in\n");
    process.exit(1);
  }
  const lines = readFileSync(join(here, "stream.ndjson"), "utf8").trim().split("\n");
  const resume = process.argv.indexOf("--resume");
  for (let line of lines) {
    if (resume > -1) line = line.replaceAll("0f3e2a1b-4c5d-4e6f-8a9b-0c1d2e3f4a5b", process.argv[resume + 1]);
    process.stdout.write(line.replace("Done.", `Done. [prompt=${stdin}] [cwd=${process.cwd()}]`) + "\n");
  }
});
