import { useCallback, useEffect, useState } from "react";
import { checkAccount, fundTestnetAccount, type AccountState } from "../funding.js";
import { appNetwork } from "../network.js";

export interface FundNoticeProps {
  /** Connected wallet address. */
  publicKey: string;
  /** Publishes the latest account state so the vote buttons can be gated. */
  onAccountState: (state: AccountState) => void;
  /** Fired once the funded account is visible on-chain. */
  onFunded: () => void;
}

function shortKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 4)}…${key.slice(-4)}` : key;
}

const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1500;

/**
 * Shown when the connected wallet has no ledger entry: it cannot source any
 * transaction (vote included), so the panel offers the testnet funding
 * endpoint and gates the vote buttons until the account exists.
 *
 * Renders nothing for funded accounts and when the network state is unknown —
 * a failed RPC check must not be mistaken for an unfunded wallet.
 */
export function FundNotice({ publicKey, onAccountState, onFunded }: FundNoticeProps) {
  const [accountState, setAccountState] = useState<AccountState>("unknown");
  const [funding, setFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-check whenever the connected account changes.
  useEffect(() => {
    let cancelled = false;
    setAccountState("unknown");
    setError(null);

    void checkAccount(publicKey).then((state) => {
      if (!cancelled) {
        setAccountState(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  // Publish the state to the parent (vote buttons disable while "missing").
  useEffect(() => {
    onAccountState(accountState);
  }, [accountState, onAccountState]);

  const handleFund = useCallback(async () => {
    if (funding) {
      return;
    }
    setFunding(true);
    setError(null);
    try {
      await fundTestnetAccount(publicKey);

      // The endpoint answers once the create-account transaction is accepted;
      // re-check so the vote buttons never re-enable against a stale ledger.
      let state: AccountState = "missing";
      for (let attempt = 0; attempt < POLL_ATTEMPTS && state !== "exists"; attempt++) {
        state = await checkAccount(publicKey);
        if (state !== "exists") {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
      setAccountState(state);
      if (state !== "exists") {
        throw new Error(
          "Account created but not visible on the network yet — wait a moment and try again."
        );
      }
      onFunded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setFunding(false);
    }
  }, [funding, publicKey, onFunded]);

  if (accountState !== "missing") {
    return null;
  }

  return (
    <div className="fund-notice" role="status">
      <div className="fund-notice__copy">
        <p className="fund-notice__title">Account not funded</p>
        <p className="fund-notice__text">
          <code>{shortKey(publicKey)}</code> has never received XLM, so it does not exist on{" "}
          {appNetwork.name} yet and cannot submit transactions — including your vote.
        </p>
      </div>
      <button
        className="fund-notice__button"
        type="button"
        onClick={() => void handleFund()}
        disabled={funding}
      >
        {funding ? "Funding…" : "Fund testnet account"}
      </button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
