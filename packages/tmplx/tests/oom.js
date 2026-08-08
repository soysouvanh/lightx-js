import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";

// Simulation of generated output
const _S0 = Buffer.from("<h1>Iteration ", "utf8");
const _S1 = Buffer.from("</h1>\n", "utf8");

function renderOom(out, view_data) {
  for (let i = 0; i < view_data.count; i++) {
    out.write(_S0);
    out.write(String(i));
    out.write(_S1);
  }
}

class NullStream extends Writable {
  _write(chunk, encoding, callback) {
    callback();
  }
}

console.log("Memory limit validation. Starting 1 million iterations...");

const stream = new NullStream();
const maxMemoryMB = 32; // Configured via node flag

const iterCount = 1_000_000;
renderOom(stream, { count: iterCount });

console.log("Validation completed successfully without OOM crash.");
