// Poseidon hash over the BLS12-381 scalar field (Caatinga's curve).
//
// This mirrors circomlib's `poseidon_opt.js` exactly (same constants and round
// order as `circomlib/circuits/poseidon.circom`), with the field swapped from
// BN254 to BLS12-381 Fr — the field circom uses when compiling with
// `-p bls12381`. Validated against a compiled circuit witness:
//   Poseidon(1) with input 12345 =>
//   30210038655452570927876935731677491109181541264348558594944850742778338046562
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// circomlibjs' package.json "exports" hides ./src/*, so locate the constants
// file relative to the package entry point instead of importing the subpath.
const packageEntry = require.resolve("circomlibjs");
const opt = require(join(dirname(packageEntry), "..", "src", "poseidon_constants_opt.json"));

// BLS12-381 scalar field order r.
export const R = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

const mod = (a) => ((a % R) + R) % R;
const parse = (a) => {
  if (typeof a === "bigint") return mod(a);
  if (a instanceof Uint8Array) return mod(BigInt(`0x${Buffer.from(a).toString("hex")}`));
  return mod(BigInt(a));
};

const add = (a, b) => mod(a + b);
const mul = (a, b) => mod(a * b);
const pow5 = (a) => mul(a, mul(mul(a, a), mul(a, a)));

const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

const cache = new Map();
function constants(t) {
  if (cache.has(t)) return cache.get(t);
  const idx = t - 2;
  const parsed = {
    C: opt.C[idx].map(parse),
    S: opt.S[idx].map(parse),
    M: opt.M[idx].map((row) => row.map(parse)),
    P: opt.P[idx].map((row) => row.map(parse)),
  };
  cache.set(t, parsed);
  return parsed;
}

/**
 * Poseidon over BLS12-381 Fr.
 * @param {Array<bigint|string|number>} inputs field elements (1..16 items)
 * @returns {bigint} hash
 */
export function poseidon(inputs) {
  if (!(inputs.length >= 1 && inputs.length <= N_ROUNDS_P.length)) {
    throw new Error(`poseidon: expected 1..${N_ROUNDS_P.length} inputs`);
  }

  const t = inputs.length + 1;
  const nRoundsF = N_ROUNDS_F;
  const nRoundsP = N_ROUNDS_P[t - 2];
  const { C, S, M, P } = constants(t);

  let state = [0n, ...inputs.map(parse)];

  // First full round: add round constants, then S-box + mix.
  state = state.map((a, i) => add(a, C[i]));

  for (let r = 0; r < nRoundsF / 2 - 1; r++) {
    state = state.map(pow5);
    state = state.map((a, i) => add(a, C[(r + 1) * t + i]));
    state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(M[j][i], a)), 0n));
  }

  // Last full round before partial rounds: S-box + add constants + mix with P.
  state = state.map(pow5);
  state = state.map((a, i) => add(a, C[(nRoundsF / 2) * t + i]));
  state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(P[j][i], a)), 0n));

  // Partial rounds: only state[0] goes through the S-box; the rest use the
  // sparse S matrix.
  for (let r = 0; r < nRoundsP; r++) {
    state[0] = add(pow5(state[0]), C[(nRoundsF / 2 + 1) * t + r]);
    const s0 = state.reduce((acc, a, j) => add(acc, mul(S[(t * 2 - 1) * r + j], a)), 0n);
    for (let k = 1; k < t; k++) {
      state[k] = add(state[k], mul(state[0], S[(t * 2 - 1) * r + t + k - 1]));
    }
    state[0] = s0;
  }

  // Final full rounds.
  for (let r = 0; r < nRoundsF / 2 - 1; r++) {
    state = state.map(pow5);
    state = state.map((a, i) => add(a, C[(nRoundsF / 2 + 1) * t + nRoundsP + r * t + i]));
    state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(M[j][i], a)), 0n));
  }
  state = state.map(pow5);
  state = state.map((_, i) => state.reduce((acc, a, j) => add(acc, mul(M[j][i], a)), 0n));

  return state[0];
}

/** Big-endian 32-byte encoding of a field element (matches on-chain BytesN<32>). */
export function toBytes32(value) {
  const v = parse(value);
  return Buffer.from(v.toString(16).padStart(64, "0"), "hex");
}

/** Inverse of {@link toBytes32}: hex string ("0x..." or bare) to bigint. */
export function fromHex(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt(`0x${clean}`);
}
