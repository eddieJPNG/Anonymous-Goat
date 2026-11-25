// Minimal typings for `snarkjs`, which ships no `.d.ts`.
//
// Only the browser path used by this app is declared: `groth16.fullProve`
// taking URL strings (snarkjs fetches them) and returning a snarkjs-shaped
// proof plus decimal-string public signals.
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: object,
      wasmFile: string,
      zkeyFileName: string,
      logger?: unknown,
      wtnsCalcOptions?: unknown,
      proverOptions?: unknown
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(vk: unknown, publicSignals: string[], proof: unknown): Promise<boolean>;
  };
}
