#!/usr/bin/env bash
# Sprint 4 E2E suite: deploys a FRESH verifier on testnet and runs the three
# acceptance tests from PLAN.MD —
#   Test 1  valid proof        -> vote accepted, tally incremented
#   Test 2  invalid proof      -> reverted with the verification error (#8)
#   Test 3  duplicate vote     -> rejected because the nullifier is used (#9)
#
# `initialize` is one-shot per contract, so every run deploys its own contract
# (the demo voters' nullifiers may already be spent on the long-lived one).
# Full output is written to docs/E2E_TEST_LOG.txt (override with TEST_LOG=...).
#
# Usage: bash scripts/test.sh   (or: npm run test:e2e)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

LOG_FILE="${TEST_LOG:-docs/E2E_TEST_LOG.txt}"
NETWORK="${TEST_NETWORK:-testnet}"
SOURCE="${TEST_SOURCE:-alice}"

ZK_ARTIFACTS=".artifacts/zk/main"
CONTRACT_WASM="contracts/verifier/target/wasm32v1-none/release/verifier.wasm"

step() { printf '\n=== %s ===\n' "$*"; }
pass() { printf 'PASS: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# `stellar contract invoke` prints its error and exits non-zero on a contract
# rejection; keep the output AND the code without tripping `set -e`.
invoke_capture() {
  set +e
  INVOKE_OUTPUT="$(stellar contract invoke --id "$CONTRACT_ID" --source "$SOURCE" \
    --network "$NETWORK" -- "$@" 2>&1)"
  INVOKE_STATUS=$?
  set -e
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

main() {
  step "Anonymous Goat — Sprint 4 E2E tests ($(date -u +%FT%TZ))"
  printf 'network=%s source=%s\n' "$NETWORK" "$SOURCE"

  step "Preconditions"
  require_cmd stellar
  require_cmd node
  require_cmd npx

  # A funded testnet identity is needed for deploy + invoke. Create one when
  # missing so the suite really runs from zero.
  #
  # NOTE: `stellar keys show` is an alias of `keys secret` in CLI 30 — it prints
  # the PRIVATE key (an `S…` strkey). Always use `keys public-key` here: the
  # admin address must be a `G…`, and the secret must never reach the log.
  if ! stellar keys public-key "$SOURCE" >/dev/null 2>&1; then
    step "Creating funded identity '$SOURCE'"
    stellar keys generate "$SOURCE" --network "$NETWORK" --fund
  fi
  ADMIN="$(stellar keys public-key "$SOURCE")"
  printf 'admin=%s\n' "$ADMIN"

  # ZK artifacts are gitignored; rebuild them (with the VK embedded in the
  # contract) when absent so the proof matches the deployed verifier.
  if [ ! -f "$ZK_ARTIFACTS/circuit_final.zkey" ] || [ ! -f "$ZK_ARTIFACTS/main_js/main.wasm" ]; then
    step "Building ZK artifacts (missing .artifacts/zk/main)"
    npx ctg zk build main --embed-vk
    npx ctg zk prove main
    node scripts/gen-test-vectors.mjs
    cargo test --manifest-path contracts/verifier/Cargo.toml
  fi
  if [ ! -f "$CONTRACT_WASM" ]; then
    step "Building contract wasm (missing $CONTRACT_WASM)"
    npx ctg build verifier
  fi
  [ -f "$CONTRACT_WASM" ] || fail "contract wasm not built: $CONTRACT_WASM"

  # Same deterministic tree the frontend and the smoke test use.
  step "Demo eligibility tree"
  read -r MERKLE_ROOT ELECTION_ID < <(
    node scripts/generate-input.mjs --root |
      node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(j.merkleRoot.slice(2)+" "+j.electionId.slice(2))})'
  )
  printf 'merkleRoot=%s\nelectionId=%s\n' "$MERKLE_ROOT" "$ELECTION_ID"

  step "Deploying a fresh verifier contract"
  DEPLOY_OUTPUT="$(stellar contract deploy --wasm "$CONTRACT_WASM" \
    --source "$SOURCE" --network "$NETWORK" -- --admin "$ADMIN")"
  CONTRACT_ID="$(grep -oE 'C[A-Z2-7]{55}' <<<"$DEPLOY_OUTPUT" | tail -1)"
  [ -n "$CONTRACT_ID" ] || fail "could not parse contract id from deploy output: $DEPLOY_OUTPUT"
  printf 'contractId=%s\n' "$CONTRACT_ID"

  step "initialize"
  stellar contract invoke --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" -- \
    initialize --admin "$ADMIN" --merkle-root "$MERKLE_ROOT" --election-id "$ELECTION_ID"
  pass "election frozen (root + electionId stored, tally zeroed)"

  # ---------------------------------------------------------------- Test 1
  step "Test 1 — valid proof is accepted and increments the tally"
  node scripts/generate-input.mjs --index 0 --vote 0
  npx ctg zk prove main
  SERIALIZED="$(node scripts/serialize-proof.mjs)"
  PROOF_JSON="$(node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]).proof))' "$SERIALIZED")"
  PUB_JSON="$(node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]).publicInputs))' "$SERIALIZED")"

  invoke_capture vote --proof "$PROOF_JSON" --public-inputs "$PUB_JSON"
  [ "$INVOKE_STATUS" -eq 0 ] || fail "valid proof was rejected: $INVOKE_OUTPUT"
  printf '%s\n' "$INVOKE_OUTPUT"

  TALLY="$(stellar contract invoke --send=no --id "$CONTRACT_ID" --source "$SOURCE" \
    --network "$NETWORK" -- get_tally)"
  printf 'tally=%s\n' "$TALLY"
  [ "$TALLY" = '{"gta6":1,"zelda":0}' ] || fail "expected {\"gta6\":1,\"zelda\":0}, got $TALLY"
  pass "vote recorded, tally is gta6=1 zelda=0"

  # ---------------------------------------------------------------- Test 2
  step "Test 2 — invalid proof is reverted with the verification error"
  # Same proof bytes, but the nullifier public input is nudged off the witness:
  # root/electionId/vote still match, so the pairing check is what must fail.
  TAMPERED_PUB_JSON="$(
    node -e '
      const p = JSON.parse(process.argv[1]);
      p.nullifier = (BigInt("0x" + p.nullifier) + 1n).toString(16).padStart(64, "0");
      console.log(JSON.stringify(p));
    ' "$PUB_JSON"
  )"
  printf 'tampered nullifier=%s\n' "$(node -e 'console.log(JSON.parse(process.argv[1]).nullifier)' "$TAMPERED_PUB_JSON")"

  invoke_capture vote --proof "$PROOF_JSON" --public-inputs "$TAMPERED_PUB_JSON"
  [ "$INVOKE_STATUS" -ne 0 ] || fail "tampered proof was ACCEPTED"
  printf '%s\n' "$INVOKE_OUTPUT"
  grep -q 'Error(Contract, #8)' <<<"$INVOKE_OUTPUT" ||
    fail "expected Error(Contract, #8) (InvalidProof), got: $INVOKE_OUTPUT"
  pass "tampered proof rejected with Error(Contract, #8) (InvalidProof)"

  # ---------------------------------------------------------------- Test 3
  step "Test 3 — duplicate vote is rejected (nullifier already used)"
  invoke_capture vote --proof "$PROOF_JSON" --public-inputs "$PUB_JSON"
  [ "$INVOKE_STATUS" -ne 0 ] || fail "duplicate vote was ACCEPTED"
  printf '%s\n' "$INVOKE_OUTPUT"
  grep -q 'Error(Contract, #9)' <<<"$INVOKE_OUTPUT" ||
    fail "expected Error(Contract, #9) (NullifierAlreadyUsed), got: $INVOKE_OUTPUT"
  pass "duplicate vote rejected with Error(Contract, #9) (NullifierAlreadyUsed)"

  # The two rejections must not have moved the tally.
  TALLY="$(stellar contract invoke --send=no --id "$CONTRACT_ID" --source "$SOURCE" \
    --network "$NETWORK" -- get_tally)"
  printf 'final tally=%s\n' "$TALLY"
  [ "$TALLY" = '{"gta6":1,"zelda":0}' ] || fail "tally changed after rejected votes: $TALLY"

  step "Summary"
  printf 'contract  : %s\n' "$CONTRACT_ID"
  printf 'Test 1    : valid proof accepted, tally incremented — PASS\n'
  printf 'Test 2    : invalid proof rejected (#8 InvalidProof)      — PASS\n'
  printf 'Test 3    : duplicate vote rejected (#9 NullifierAlreadyUsed) — PASS\n'
  printf 'ALL TESTS PASSED\n'
}

# Everything (including stderr, where the CLI prints rejections) goes to the log.
# `-e` is lifted so the leak guard below runs even when the suite fails.
set +e
main 2>&1 | tee "$LOG_FILE"
STATUS=$?
set -e

# Safety net: an `S…` strkey is a secret seed (G… = public key). The suite must
# never write one to a committable file — see the `keys public-key` note above.
if grep -qE '(^|[^A-Z2-7])S[A-Z2-7]{55}([^A-Z2-7]|$)' "$LOG_FILE"; then
  printf 'FAIL: secret key material found in %s — do not commit this file\n' "$LOG_FILE" >&2
  exit 1
fi

exit "$STATUS"
