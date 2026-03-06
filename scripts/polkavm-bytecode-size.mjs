#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = path.join(root, "contracts/artifacts/src/AgroasysEscrow.sol/AgroasysEscrow.json");

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const fmt = artifact._format ?? "unknown";
const hex = artifact.bytecode.startsWith("0x") ? artifact.bytecode.slice(2) : artifact.bytecode;
const bytes = hex.length / 2;
const EVM_CAP = 49152;

console.log(`Format   : ${fmt}`);
console.log(`Bytecode : ${bytes.toLocaleString()} bytes (${(bytes / 1024).toFixed(1)} KB)`);
console.log(`EVM cap  : ${EVM_CAP.toLocaleString()} bytes (48 KB, EIP-3860)`);
if (bytes > EVM_CAP) {
  console.log(`Status   : EXCEEDS EVM limit by ${(bytes - EVM_CAP).toLocaleString()} bytes`);
} else {
  console.log(`Status   : within EVM limit`);
}