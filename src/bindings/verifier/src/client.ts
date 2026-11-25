import {Proof, PublicInputs, Groth16Error, Tally, VerificationKey, ContractEvent} from './types.js';
import {Result, Spec, AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, ExternalExecutableRef} from '@stellar/stellar-sdk/contract';
import {Address, xdr} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional: Client is both the typed interface and the ContractClient subclass that dispatches its methods via Proxy.
export interface Client {
  /**
   * Accepts a Groth16 proof of eligibility and records the vote.
   *
   * Order of checks: election config → public inputs → proof → nullifier →
   * tally → event. Nothing is written until every check has passed.
   */
  vote({ proof, public_inputs }: { proof: Proof; public_inputs: PublicInputs }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Groth16Error>>>;
  /**
   * Returns the account allowed to call `upgrade` and `initialize`.
   */
  admin(options?: MethodOptions): Promise<AssembledTransaction<Result<string, Groth16Error>>>;
  /**
   * Replaces the contract WASM in place, keeping the contract ID. Only the
   * admin may call it; `ctg upgrade verifier` invokes it after
   * `ctg zk build --embed-vk` changes the embedded verification key.
   */
  upgrade({ new_wasm_hash }: { new_wasm_hash: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Groth16Error>>>;
  /**
   * Current vote counts. Errors before `initialize`, so a caller never
   * mistakes "not set up yet" for "no votes yet".
   */
  get_tally(options?: MethodOptions): Promise<AssembledTransaction<Result<Tally, Groth16Error>>>;
  /**
   * Freezes the election parameters: the Merkle root of the eligible voters
   * and the election id that domains every nullifier.
   *
   * `admin` must be the account stored by the constructor and must sign the
   * call, so no third party can re-point the election after deployment.
   */
  initialize({ admin, merkle_root, election_id }: { admin: string | Address; merkle_root: Buffer; election_id: Buffer }, options?: MethodOptions): Promise<AssembledTransaction<Result<null, Groth16Error>>>;
  verify_proof({ vk, proof, pub_signals }: { vk: VerificationKey; proof: Proof; pub_signals: Array<bigint> }, options?: MethodOptions): Promise<AssembledTransaction<Result<boolean, Groth16Error>>>;
  /**
   * Verifies with the verification key baked into the contract by
   * `ctg zk build --embed-vk`, which overwrites `src/vk.rs`.
   *
   * Prefer this once a circuit is frozen: it removes the VK argument from
   * every transaction and makes the deployed contract self-contained. Use
   * `verify_proof` instead while a circuit is still changing.
   */
  verify_proof_embedded({ proof, pub_signals }: { proof: Proof; pub_signals: Array<bigint> }, options?: MethodOptions): Promise<AssembledTransaction<Result<boolean, Groth16Error>>>;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- intentional: Client is both the typed interface and the ContractClient subclass that dispatches its methods via Proxy.
export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new Spec(["AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAA+4AAABgAAAAAAAAAAFiAAAAAAAD7gAAAMAAAAAAAAAAAWMAAAAAAAPuAAAAYA==", "AAAAAQAAAEpQdWJsaWMgdm90ZSBjb3VudHMuIGBndGE2YCBjb3VudHMgYHZvdGUgPT0gMGAsIGB6ZWxkYWAgY291bnRzIGB2b3RlID09IDFgLgAAAAAAAAAAAAVUYWxseQAAAAAAAAIAAAAAAAAABGd0YTYAAAAEAAAAAAAAAAV6ZWxkYQAAAAAAAAQ=", "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAKTWVya2xlUm9vdAAAAAAAAAAAAAAAAAAKRWxlY3Rpb25JZAAAAAAAAAAAAAAAAAAKTnVsbGlmaWVycwAAAAAAAAAAAAAAAAAFVGFsbHkAAAA=", "AAAABQAAAHxFbWl0dGVkIG9uY2UgcGVyIGFjY2VwdGVkIHZvdGUuIFRoZSBudWxsaWZpZXIgaXMgYSB0b3BpYyBzbyBpbmRleGVycyBjYW4Kc3BvdCBhIHJlcGxheSBhdHRlbXB0IHdpdGhvdXQgZGVjb2RpbmcgdGhlIHBheWxvYWQuAAAAAAAAAAhWb3RlQ2FzdAAAAAEAAAAIVm90ZUNhc3QAAAACAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAEAAAAAAAAABHZvdGUAAAAEAAAAAAAAAAA=", "AAAABAAAAAAAAAAAAAAADEdyb3RoMTZFcnJvcgAAAAoAAAAAAAAAFU1hbGZvcm1lZFZlcmlmeWluZ0tleQAAAAAAAAAAAAAAAAAAC0FkbWluTm90U2V0AAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAMAAAAAAAAADFVuYXV0aG9yaXplZAAAAAQAAAAAAAAADFJvb3RNaXNtYXRjaAAAAAUAAAAAAAAAEEVsZWN0aW9uTWlzbWF0Y2gAAAAGAAAAAAAAAAtJbnZhbGlkVm90ZQAAAAAHAAAAAAAAAAxJbnZhbGlkUHJvb2YAAAAIAAAAAAAAABROdWxsaWZpZXJBbHJlYWR5VXNlZAAAAAk=", "AAAAAQAAAMJUaGUgZm91ciBwdWJsaWMgc2lnbmFscyBvZiB0aGUgY2lyY3VpdCwgaW4gdGhlIGNhbGxlcidzIHRlcm1zLiBUaGUgY29udHJhY3QKcmUtb3JkZXJzIHRoZW0gaW50byB0aGUgc25hcmtqcyBvcmRlciBgW251bGxpZmllciwgbWVya2xlUm9vdCwgZWxlY3Rpb25JZCwKdm90ZV1gIGJlZm9yZSBoYW5kaW5nIHRoZW0gdG8gdGhlIHZlcmlmaWVyLgAAAAAAAAAAAAxQdWJsaWNJbnB1dHMAAAAEAAAAAAAAAAtlbGVjdGlvbl9pZAAAAAPuAAAAIAAAAAAAAAALbWVya2xlX3Jvb3QAAAAD7gAAACAAAAAAAAAACW51bGxpZmllcgAAAAAAA+4AAAAgAAAAAAAAAAR2b3RlAAAABA==", "AAAAAQAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQAAAAAFAAAAAAAAAAVhbHBoYQAAAAAAA+4AAABgAAAAAAAAAARiZXRhAAAD7gAAAMAAAAAAAAAABWRlbHRhAAAAAAAD7gAAAMAAAAAAAAAABWdhbW1hAAAAAAAD7gAAAMAAAAAAAAAAAmljAAAAAAPqAAAD7gAAAGA=", "AAAAAAAAAM5BY2NlcHRzIGEgR3JvdGgxNiBwcm9vZiBvZiBlbGlnaWJpbGl0eSBhbmQgcmVjb3JkcyB0aGUgdm90ZS4KCk9yZGVyIG9mIGNoZWNrczogZWxlY3Rpb24gY29uZmlnIOKGkiBwdWJsaWMgaW5wdXRzIOKGkiBwcm9vZiDihpIgbnVsbGlmaWVyIOKGkgp0YWxseSDihpIgZXZlbnQuIE5vdGhpbmcgaXMgd3JpdHRlbiB1bnRpbCBldmVyeSBjaGVjayBoYXMgcGFzc2VkLgAAAAAABHZvdGUAAAACAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAFUHJvb2YAAAAAAAAAAAAADXB1YmxpY19pbnB1dHMAAAAAAAfQAAAADFB1YmxpY0lucHV0cwAAAAEAAAPpAAAAAgAAB9AAAAAMR3JvdGgxNkVycm9y", "AAAAAAAAAD9SZXR1cm5zIHRoZSBhY2NvdW50IGFsbG93ZWQgdG8gY2FsbCBgdXBncmFkZWAgYW5kIGBpbml0aWFsaXplYC4AAAAABWFkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAB9AAAAAMR3JvdGgxNkVycm9y", "AAAAAAAAAMJSZXBsYWNlcyB0aGUgY29udHJhY3QgV0FTTSBpbiBwbGFjZSwga2VlcGluZyB0aGUgY29udHJhY3QgSUQuIE9ubHkgdGhlCmFkbWluIG1heSBjYWxsIGl0OyBgY3RnIHVwZ3JhZGUgdmVyaWZpZXJgIGludm9rZXMgaXQgYWZ0ZXIKYGN0ZyB6ayBidWlsZCAtLWVtYmVkLXZrYCBjaGFuZ2VzIHRoZSBlbWJlZGRlZCB2ZXJpZmljYXRpb24ga2V5LgAAAAAAB3VwZ3JhZGUAAAAAAQAAAAAAAAANbmV3X3dhc21faGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAACAAAH0AAAAAxHcm90aDE2RXJyb3I=", "AAAAAAAAAHBDdXJyZW50IHZvdGUgY291bnRzLiBFcnJvcnMgYmVmb3JlIGBpbml0aWFsaXplYCwgc28gYSBjYWxsZXIgbmV2ZXIKbWlzdGFrZXMgIm5vdCBzZXQgdXAgeWV0IiBmb3IgIm5vIHZvdGVzIHlldCIuAAAACWdldF90YWxseQAAAAAAAAAAAAABAAAD6QAAB9AAAAAFVGFsbHkAAAAAAAfQAAAADEdyb3RoMTZFcnJvcg==", "AAAAAAAAAQZGcmVlemVzIHRoZSBlbGVjdGlvbiBwYXJhbWV0ZXJzOiB0aGUgTWVya2xlIHJvb3Qgb2YgdGhlIGVsaWdpYmxlIHZvdGVycwphbmQgdGhlIGVsZWN0aW9uIGlkIHRoYXQgZG9tYWlucyBldmVyeSBudWxsaWZpZXIuCgpgYWRtaW5gIG11c3QgYmUgdGhlIGFjY291bnQgc3RvcmVkIGJ5IHRoZSBjb25zdHJ1Y3RvciBhbmQgbXVzdCBzaWduIHRoZQpjYWxsLCBzbyBubyB0aGlyZCBwYXJ0eSBjYW4gcmUtcG9pbnQgdGhlIGVsZWN0aW9uIGFmdGVyIGRlcGxveW1lbnQuAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAttZXJrbGVfcm9vdAAAAAPuAAAAIAAAAAAAAAALZWxlY3Rpb25faWQAAAAD7gAAACAAAAABAAAD6QAAAAIAAAfQAAAADEdyb3RoMTZFcnJvcg==", "AAAAAAAAAAAAAAAMdmVyaWZ5X3Byb29mAAAAAwAAAAAAAAACdmsAAAAAB9AAAAAPVmVyaWZpY2F0aW9uS2V5AAAAAAAAAAAFcHJvb2YAAAAAAAfQAAAABVByb29mAAAAAAAAAAAAAAtwdWJfc2lnbmFscwAAAAPqAAAADAAAAAEAAAPpAAAAAQAAB9AAAAAMR3JvdGgxNkVycm9y", "AAAAAAAAAJtTdG9yZXMgdGhlIGFjY291bnQgYWxsb3dlZCB0byBjYWxsIGB1cGdyYWRlYCBhbmQgYGluaXRpYWxpemVgLiBDYWF0aW5nYQpwYXNzZXMgdGhlIGRlcGxveWluZyBpZGVudGl0eSB0aHJvdWdoIGBkZXBsb3lBcmdzOiB7IGFkbWluOiAiJHtzb3VyY2UuYWRkcmVzc30iIH1gLgAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=", "AAAAAAAAAT1WZXJpZmllcyB3aXRoIHRoZSB2ZXJpZmljYXRpb24ga2V5IGJha2VkIGludG8gdGhlIGNvbnRyYWN0IGJ5CmBjdGcgemsgYnVpbGQgLS1lbWJlZC12a2AsIHdoaWNoIG92ZXJ3cml0ZXMgYHNyYy92ay5yc2AuCgpQcmVmZXIgdGhpcyBvbmNlIGEgY2lyY3VpdCBpcyBmcm96ZW46IGl0IHJlbW92ZXMgdGhlIFZLIGFyZ3VtZW50IGZyb20KZXZlcnkgdHJhbnNhY3Rpb24gYW5kIG1ha2VzIHRoZSBkZXBsb3llZCBjb250cmFjdCBzZWxmLWNvbnRhaW5lZC4gVXNlCmB2ZXJpZnlfcHJvb2ZgIGluc3RlYWQgd2hpbGUgYSBjaXJjdWl0IGlzIHN0aWxsIGNoYW5naW5nLgAAAAAAABV2ZXJpZnlfcHJvb2ZfZW1iZWRkZWQAAAAAAAACAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAFUHJvb2YAAAAAAAAAAAAAC3B1Yl9zaWduYWxzAAAAA+oAAAAMAAAAAQAAA+kAAAABAAAH0AAAAAxHcm90aDE2RXJyb3I="]),
      options
    );
  }

   static deploy<T = Client>({ admin }: { admin: string | Address }, options: MethodOptions & Omit<ContractClientOptions, 'contractId'> & { salt?: Buffer | Uint8Array; address?: string; } & ({ wasmHash: Buffer | string; format?: "hex" | "base64"; externalRef?: never; } | { externalRef: ExternalExecutableRef; wasmHash?: never; format?: never; })): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin }, options);
  }
  public readonly fromJSON = {
    vote : this.txFromJSON<Result<null, Groth16Error>>,  admin : this.txFromJSON<Result<string, Groth16Error>>,  upgrade : this.txFromJSON<Result<null, Groth16Error>>,  get_tally : this.txFromJSON<Result<Tally, Groth16Error>>,  initialize : this.txFromJSON<Result<null, Groth16Error>>,  verify_proof : this.txFromJSON<Result<boolean, Groth16Error>>,  verify_proof_embedded : this.txFromJSON<Result<boolean, Groth16Error>>
  };

  /**
   * Parse a raw contract event (topics + data) into a typed {@link ContractEvent}.
   */
  parseEvent(topics: xdr.ScVal[] | string[], data: xdr.ScVal | string): ContractEvent | undefined {
    return this.spec.parseEvent(topics, data) as ContractEvent | undefined;
  }
  /**
   * Build a topics filter row for the "VoteCast" event, for use in `Api.EventFilter.topics` when calling `server.getEvents`. Omitted fields match any value.
   */
  voteCastEventFilter(topicValues?: { nullifier?: Buffer }): string[] {
    return this.spec.eventTopicFilter("VoteCast", topicValues);
  }
}