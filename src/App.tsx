import { useCallback, useEffect, useState } from "react";
import { WalletProvider, useWallet } from "@caatinga/client/react";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import gtaCover from "../assets/GTAVI.png";
import zeldaCover from "../assets/TLOZOOTR.jpg";
import { ContractNotDeployed } from "./components/ContractNotDeployed";
import { FundNotice } from "./components/FundNotice";
import { GameCard } from "./components/GameCard";
import { LoadingModal } from "./components/LoadingModal";
import { WalletButton } from "./components/WalletButton";
import { WalletModal } from "./components/WalletModal";
import { appNetwork } from "./network.js";
import { stellarWalletAdapter } from "./wallet.js";
import type { AccountState } from "./funding.js";
import { demoTree, demoVoter } from "./zk/demo-tree.js";
import { buildVoteInput, proveVote } from "./zk/prove.js";
import { toBindingProof, toPublicInputs } from "./zk/serialize.js";
import { castVote, describeVoteError, fetchTally } from "./vote.js";
import type { Tally } from "./bindings/verifier/src/types.js";

const artifacts = artifactsJson as CaatingaArtifacts;
const verifierContractId =
  artifacts.networks?.[appNetwork.name]?.contracts?.verifier?.contractId;
const isDeployed = Boolean(verifierContractId);

/** Voter 0 already cast a ballot on the deployed contract, so default to 1. */
const DEFAULT_VOTER = 1;

type Phase = "idle" | "proving" | "voting";

const PHASE_LABELS: Record<Exclude<Phase, "idle">, string> = {
  proving: "Generating proof in your browser…",
  voting: "Approve the transaction in your wallet…",
};

function AppBody() {
  const { publicKey } = useWallet();
  const [tally, setTally] = useState<Tally | undefined>(undefined);
  const [tallyError, setTallyError] = useState<string | null>(null);
  const [voterIndex, setVoterIndex] = useState(DEFAULT_VOTER);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Ledger state of the connected wallet's account ("missing" = never funded,
  // published by <FundNotice/>); votes are gated while it cannot source a tx.
  const [accountState, setAccountState] = useState<AccountState>("unknown");

  const refreshTally = useCallback(async () => {
    try {
      setTally(await fetchTally());
      setTallyError(null);
    } catch (caught) {
      setTallyError(describeVoteError(caught));
    }
  }, []);

  useEffect(() => {
    void refreshTally();
  }, [refreshTally]);

  // On disconnect the notice unmounts without reporting back, so reset here.
  useEffect(() => {
    if (!publicKey) {
      setAccountState("unknown");
    }
  }, [publicKey]);

  const handleFunded = useCallback(() => {
    setSuccess("Testnet account funded — you can vote now.");
  }, []);

  async function handleVote(vote: 0 | 1) {
    setError(null);
    setSuccess(null);

    if (!publicKey) {
      setError("Connect a wallet before voting.");
      return;
    }
    if (accountState === "missing") {
      setError("Fund the wallet account first — see the notice above the vote buttons.");
      return;
    }
    if (phase !== "idle") {
      return;
    }

    try {
      // 1. Assemble input.json from the selected elector's secret + Merkle path.
      const input = buildVoteInput(demoVoter(voterIndex), vote);

      // 2. Prove in the browser (snarkjs + the wasm/zkey served by Vite).
      setPhase("proving");
      const { proof, publicSignals } = await proveVote(input);

      // 3. Sign and submit through the connected wallet.
      setPhase("voting");
      const result = await castVote(toBindingProof(proof), toPublicInputs(publicSignals));

      const gameName = vote === 0 ? "GTA 6" : "Zelda";
      setSuccess(
        `Vote for ${gameName} accepted${
          result.transactionHash ? ` — tx ${result.transactionHash}` : ""
        }.`
      );
      await refreshTally();
    } catch (caught) {
      setError(describeVoteError(caught));
      // A rejected vote may still have changed nothing, but refresh anyway so
      // the displayed tally always reflects the chain.
      void refreshTally();
    } finally {
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Stellar · Soroban · Groth16</p>
          <h1>Anonymous Goat</h1>
        </div>
        <WalletButton />
      </header>

      {!isDeployed ? (
        <ContractNotDeployed />
      ) : (
        <>
          <section className="tally-panel" aria-labelledby="tally-title">
            <div className="tally-panel__header">
              <div>
                <p className="eyebrow">Live tally</p>
                <h2 id="tally-title">Best game of 2026</h2>
              </div>
              <span className="network-pill">{appNetwork.name}</span>
            </div>

            <div className="tally-scores">
              <div className="tally-score">
                <strong className="tally-score__value">{tally?.gta6 ?? "—"}</strong>
                <span className="tally-score__label">GTA 6</span>
              </div>
              <span className="tally-score__vs" aria-hidden="true">
                vs
              </span>
              <div className="tally-score">
                <strong className="tally-score__value">{tally?.zelda ?? "—"}</strong>
                <span className="tally-score__label">Zelda</span>
              </div>
            </div>

            <div className="tally-panel__footer">
              <p className="connection-state">
                {publicKey ? (
                  <>
                    <span className="status-dot status-dot--on" aria-hidden="true" />
                    Wallet connected
                  </>
                ) : (
                  <>
                    <span className="status-dot" aria-hidden="true" />
                    Wallet not connected
                  </>
                )}
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void refreshTally()}
                disabled={busy}
              >
                Refresh tally
              </button>
            </div>

            {tallyError ? (
              <p className="field-error" role="alert">
                {tallyError}
              </p>
            ) : null}
          </section>

          <section className="vote-panel" aria-labelledby="vote-title">
            {busy ? <LoadingModal label={PHASE_LABELS[phase]} /> : null}

            <div className="vote-panel__header">
              <div>
                <p className="eyebrow">Cast your vote</p>
                <h2 id="vote-title">Choose a game</h2>
              </div>
              <label className="voter-select">
                <span>Demo elector</span>
                <select
                  value={voterIndex}
                  onChange={(event) => setVoterIndex(Number(event.target.value))}
                  disabled={busy}
                >
                  {demoTree.voters.map((voter) => (
                    <option key={voter.index} value={voter.index}>
                      Elector #{voter.index}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="vote-panel__hint">
              The proof is generated in this browser from the elector&apos;s secret and Merkle
              path, then verified on-chain. Each elector may vote once.
            </p>

            {publicKey ? (
              <FundNotice
                publicKey={publicKey}
                onAccountState={setAccountState}
                onFunded={handleFunded}
              />
            ) : null}

            <div className="game-grid">
              <GameCard
                title="GTA 6"
                eyebrow="vote = 0"
                cover={gtaCover}
                vote={0}
                tally={tally?.gta6}
                disabled={busy || accountState === "missing"}
                busy={busy}
                onVote={(vote) => void handleVote(vote)}
              />
              <GameCard
                title="Zelda"
                eyebrow="vote = 1"
                cover={zeldaCover}
                vote={1}
                tally={tally?.zelda}
                disabled={busy || accountState === "missing"}
                busy={busy}
                onVote={(vote) => void handleVote(vote)}
              />
            </div>

            {!publicKey ? (
              <p className="vote-panel__hint" role="status">
                Connect a Freighter-compatible wallet to enable the vote buttons.
              </p>
            ) : null}

            {success ? (
              <p className="vote-success" role="status">
                {success}
              </p>
            ) : null}
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </>
      )}

      <footer className="app-footer">
        <p>
          Anonymity covers the elector, not the ballot: every vote is public on-chain, and each
          secret can be used only once.
        </p>
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <WalletProvider adapter={stellarWalletAdapter} options={{ persist: true }}>
      <AppBody />
      <WalletModal />
    </WalletProvider>
  );
}
