#!/usr/bin/env node
import { main } from "./cli/main.js";

process.exitCode = main(process.argv.slice(2), {
  write: (text) => {
    process.stdout.write(text);
  },
  writeError: (text) => {
    process.stderr.write(text);
  },
});
