#!/usr/bin/env node
// Serializes .artifacts/zk/main/proof.json + public.json into the JSON
// arguments `stellar contract invoke -- vote --proof ... --public-inputs ...`
// expects for the verifier contract.
//
// Curve byte layouts (both big-endian, both matching the Soroban host):
//   G1 -> x(48) || y(48)                       => 192 hex chars
//   G2 -> x.c1(48) || x.c0(48) || y.c1(48) || y.c0(48) => 384 hex chars
// snarkjs prints each G2 coordinate as [c0, c1], so the two halves are swapped
// relative to the file. BytesN arguments take bare hex, without a 0x prefix.
//
// Usage: node scripts/serialize-proof.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = join(ROOT_DIR, ".artifacts", "zk", "main");

const proof = JSON.parse(readFileSync(join(ARTIFACTS, "proof.json"), "utf8"));
// snarkjs order: [nullifier, merkleRoot, electionId, vote].
const [nullifier, merkleRoot, electionId, vote] = JSON.parse(
  readFileSync(join(ARTIFACTS, "public.json"), "utf8")
);

if (proof.curve !== "bls12381") {
  throw new Error(`expected bls12381 proof, got ${proof.curve}`);
}

/** Field element (decimal string) -> bare 48-byte big-endian hex. */
function be48(decimal) {
  return BigInt(decimal).toString(16).padStart(96, "0");
}

/** Field element (decimal string) -> bare 32-byte big-endian hex. */
function be32(decimal) {
  return BigInt(decimal).toString(16).padStart(64, "0");
}

const g1 = ([x, y]) => `${be48(x)}${be48(y)}`;
const g2 = ([[x0, x1], [y0, y1]]) => `${be48(x1)}${be48(x0)}${be48(y1)}${be48(y0)}`;

const proofArg = {
  a: g1(proof.pi_a),
  b: g2(proof.pi_b),
  c: g1(proof.pi_c),
};

const publicInputsArg = {
  merkle_root: be32(merkleRoot),
  election_id: be32(electionId),
  nullifier: be32(nullifier),
  vote: Number(vote),
};

console.log(JSON.stringify({ proof: proofArg, publicInputs: publicInputsArg }));
