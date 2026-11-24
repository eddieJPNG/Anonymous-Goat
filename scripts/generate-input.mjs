#!/usr/bin/env node
// Builds the demo eligibility Merkle tree and writes circuits/input.json
// (plus circuits/input.example.json) for `npx ctg zk prove main`.
//
// The demo tree is deterministic so the root stored by `initialize` stays
// stable across runs. Secrets are demo-only values derived from a fixed seed —
// real voter secrets are distributed off-chain and never committed.
//
// Usage:
//   node scripts/generate-input.mjs [--index <leaf>] [--vote <0|1>]
//   node scripts/generate-input.mjs --root   # print root/electionId only
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { R } from "./lib/poseidon.mjs";
import {
  DEPTH,
  NUM_LEAVES,
  buildTree,
  commitment,
  computeRoot,
  getPath,
  toHex32,
  toSignal,
} from "./lib/merkle.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

// 4 demo voters; the remaining 12 leaves are padded with 0 (finding a secret
// whose Poseidon hash equals 0 is infeasible, so padding is safe).
const NUM_DEMO_VOTERS = 4;

// Fixed election id (BytesN<32>): sha256 of the election label, reduced into
// the scalar field so the 32-byte encoding maps 1:1 to an Fr on-chain.
// Deterministic across runs, so `initialize` and the nullifier domain never drift.
export const ELECTION_ID = (() => {
  const h = createHash("sha256").update("anonymous-goat/best-game-2026").digest();
  return (BigInt(`0x${h.toString("hex")}`) % R).toString(16).padStart(64, "0");
})();

function demoSecret(i) {
  const h = createHash("sha256").update(`anonymous-goat/demo-voter/${i}`).digest();
  return BigInt(`0x${h.toString("hex")}`) % R;
}

/** @returns {{levels: bigint[][], root: bigint}} */
export function buildDemoTree() {
  const leaves = Array(NUM_LEAVES).fill(0n);
  for (let i = 0; i < NUM_DEMO_VOTERS; i++) {
    leaves[i] = commitment(demoSecret(i));
  }
  const tree = buildTree(leaves);
  const { pathElements, pathIndices } = getPath(tree.levels, 0);
  if (computeRoot(leaves[0], pathElements, pathIndices) !== tree.root) {
    throw new Error("merkle path sanity check failed");
  }
  return tree;
}

export function inputFor(index, vote) {
  if (!Number.isInteger(index) || index < 0 || index >= NUM_DEMO_VOTERS) {
    throw new Error(`--index must be 0..${NUM_DEMO_VOTERS - 1} (demo voters)`);
  }
  if (vote !== 0 && vote !== 1) {
    throw new Error("--vote must be 0 (GTA 6) or 1 (Zelda)");
  }

  const { levels, root } = buildDemoTree();
  const { pathElements, pathIndices } = getPath(levels, index);

  // snarkjs input.json: every `signal input` of the circuit (public and
  // private), never outputs — `nullifier` is derived during proving.
  return {
    secret: toSignal(demoSecret(index)),
    merklePath: pathElements.map(toSignal),
    merkleIndices: pathIndices.map(toSignal),
    merkleRoot: toSignal(root),
    electionId: toSignal(BigInt(`0x${ELECTION_ID}`)),
    vote: String(vote),
  };
}

function parseArgs(argv) {
  const args = { index: 0, vote: 0, rootOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") args.rootOnly = true;
    else if (a === "--index") args.index = Number(argv[++i]);
    else if (a === "--vote") args.vote = Number(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { root } = buildDemoTree();

  if (args.rootOnly) {
    console.log(JSON.stringify({ merkleRoot: toHex32(root), electionId: toHex32(`0x${ELECTION_ID}`) }, null, 2));
    return;
  }

  const input = inputFor(args.index, args.vote);
  const example = inputFor(0, 0);

  writeFileSync(join(ROOT_DIR, "circuits", "input.json"), `${JSON.stringify(input, null, 2)}\n`);
  writeFileSync(
    join(ROOT_DIR, "circuits", "input.example.json"),
    `${JSON.stringify(example, null, 2)}\n`
  );

  console.log(`merkleRoot : ${toHex32(root)}`);
  console.log(`electionId : ${toHex32(`0x${ELECTION_ID}`)}`);
  console.log(`leaf index : ${args.index}  vote: ${args.vote}`);
  console.log(`wrote circuits/input.json and circuits/input.example.json`);
}

// Only run when executed directly (imports stay side-effect free).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
