#!/usr/bin/env node
// Writes circuits/demo-tree.json — the demo eligibility tree the frontend
// loads to assemble the snarkjs `input.json` for a chosen voter (Sprint 3).
//
// The tree and election id are the exact same ones `generate-input.mjs` builds
// and `initialize` froze on-chain, so the browser proves against the root the
// contract stores. Secrets are demo-only values derived from a fixed seed —
// real voter secrets are distributed off-chain and never committed.
//
// Usage: node scripts/gen-demo-tree.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ELECTION_ID, demoSecret } from "./generate-input.mjs";
import {
  DEPTH,
  NUM_LEAVES,
  buildTree,
  commitment,
  getPath,
  toHex32,
  toSignal,
} from "./lib/merkle.mjs";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same 4 demo voters as generate-input.mjs; the other 12 leaves stay0.
const NUM_DEMO_VOTERS = 4;

function main() {
  const leaves = Array(NUM_LEAVES).fill(0n);
  for (let i = 0; i < NUM_DEMO_VOTERS; i++) {
    leaves[i] = commitment(demoSecret(i));
  }
  const tree = buildTree(leaves);

  const voters = [];
  for (let i = 0; i < NUM_DEMO_VOTERS; i++) {
    const { pathElements, pathIndices } = getPath(tree.levels, i);
    voters.push({
      index: i,
      secret: toSignal(demoSecret(i)),
      merklePath: pathElements.map(toSignal),
      merkleIndices: pathIndices.map(toSignal),
    });
  }

  const document = {
    depth: DEPTH,
    numVoters: NUM_DEMO_VOTERS,
    // snarkjs input.json format: decimal field elements.
    electionId: toSignal(BigInt(`0x${ELECTION_ID}`)),
    merkleRoot: toSignal(tree.root),
    // 0x-prefixed big-endian BytesN<32> for display and contract arguments.
    electionIdHex: toHex32(`0x${ELECTION_ID}`),
    merkleRootHex: toHex32(tree.root),
    voters,
  };

  const outPath = join(ROOT_DIR, "circuits", "demo-tree.json");
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`wrote circuits/demo-tree.json`);
  console.log(`merkleRoot : ${document.merkleRootHex}`);
  console.log(`electionId : ${document.electionIdHex}`);
  console.log(`voters     : ${voters.length} (depth ${DEPTH})`);
}

main();
