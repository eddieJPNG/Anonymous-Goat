# Caatinga Friction Log — Anonymous Goat

Dificuldades encontradas ao usar o Caatinga CLI e o ecossistema ZK/Soroban.
Atualizado ao fim de cada sprint.

## Ferramentas e versões

| Ferramenta | Versão usada | Última testada pelo Caatinga | Observação |
|---|---|---|---|
| `@caatinga/cli` (ctg) | 3.14.0 | — | instalado via `npx` |
| Stellar CLI | 30.0.1 | 28.0.0 | warning do `ctg doctor` |
| `@stellar/stellar-sdk` | 17.4.0 | 16.0.1 | warning do `ctg doctor` |
| circom | 2.1.9 | — | cache do Caatinga (`~/.caatinga/zk-tools`) |
| snarkjs | 0.7.5 | — | cache do Caatinga |

## Sprint 1 — Setup + Circuito ZK

### F1. Instalação do Stellar CLI não existe no npm

`npm install -g @stellar/stellar-cli` retorna 404 — o pacote não é publicado
nessa nomeação. O `ctg doctor` exige o binário `stellar` no PATH.

**Workaround:** baixar o binário pré-compilado do release oficial
(`github.com/stellar/stellar-cli/releases`, tarball `stellar-cli-<ver>-x86_64-unknown-linux-gnu.tar.gz`)
e copiar para `~/.local/bin`.

### F2. `rustup`/target `wasm32v1-none` ausentes em ambiente Arch

O `ctg build` exige o target `wasm32v1-none` (não `wasm32-unknown-unknown`).
Em Arch, `rustc` vem do pacote do sistema e não há `rustup` por padrão.

**Workaround:** instalar rustup minimal (`sh.rustup.rs`) e
`rustup target add wasm32v1-none`.

### F3. `ctg zk init` sem nome falha se não há `caatinga.config.ts`

`npx ctg zk init` (sem argumento) exige um `caatinga.config.ts` já existente no
diretório corrente e falha com `CAATINGA_UNEXPECTED_ERROR` — o comando não
cria o projeto do zero sem nome.

**Workaround:** `npx ctg zk init .` cria o scaffold no diretório corrente.

### F4. Includes do circom são relativos ao arquivo, e o Caatinga não passa `-l`

`ctg zk build` não expõe opção de include path (`-l`), e o circom resolve
`include` **relativo ao arquivo que inclui** (não ao CWD). Portanto
`include "circomlib/circuits/poseidon.circom"` falha com `error[P1014]`.

**Workaround:** no circuito, usar caminho relativo ao arquivo:
`include "../node_modules/circomlib/circuits/poseidon.circom"`.

### F5. `circomlibjs` bloqueia subcaminhos no `exports`

`import ... from "circomlibjs/src/poseidon_constants_opt.json"` falha com
`ERR_PACKAGE_PATH_NOT_EXPORTED` — o `package.json` do circomlibjs só exporta
`./main.js` e `./build/main.cjs`.

**Workaround:** resolver o entry point com `require.resolve("circomlibjs")` e
ler o JSON relativo a ele (`../src/poseidon_constants_opt.json`).

### F6. circom default é BN254; o Caatinga usa BLS12-381

O circom compilado manualmente usa `bn128` por padrão. Os testes de saída do
witness divergem do JS se a curva estiver errada (o campo escalar é outro).

**Workaround:** sempre `--prime bls12381` em compilações manuais; o
`ctg zk build` já usa `bls12381` por padrão.

### F7. Poseidon precisa ser portado para o campo BLS12-381

`circomlibjs` só oferece Poseidon sobre BN254 (`buildPoseidonOpt` usa
`getCurveFromName("bn128")`). O circuito do Caatinga roda em BLS12-381, então
o hash off-chain (Merkle tree, nullifier) precisa do mesmo algoritmo com o
campo `r` da BLS12-381.

**Workaround:** port de `poseidon_opt.js` para `BigInt` com
`r = 0x73eda753...00000001` em `scripts/lib/poseidon.mjs`, validado contra o
witness do circuito compilado (`Poseidon(1)` / input `12345` bate exatamente).

### F8. Dev ceremony regenera as chaves a cada `zk build`

O `ctg zk build` emite: *"New proving and verification keys were generated:
re-run `ctg zk prove main` before invoking."* — qualquer rebuild invalida
provas anteriores.

**Workaround:** fluxo fixo `zk build` → `zk prove` → `zk invoke` (sem rebuild
entre prove e invoke).

### F9. Ordem dos public signals não é a de declaração no `main`

O snarkjs ordena os public signals como **outputs primeiro, depois inputs
públicos na ordem do `{public [...]}`** — não na ordem de declaração dos
sinais no template. Para este circuito a ordem real é:

```
[nullifier, merkleRoot, electionId, vote]
```

**Workaround:** o contrato deve montar o `Vec<Fr>` nessa ordem exata; confirmar
sempre via `.artifacts/zk/<circuit>/public.json` após o `zk prove`.

---

## Sprint 2 — Contrato verificador + deploy

### F10. Argumentos `BytesN` na Stellar CLI são hex **sem** `0x`

`stellar contract invoke ... --merkle-root 0x02ae…` falha com
`Expected type bytes32 (exactly 32 bytes), but received: '0x02ae…'` — o parser de
`ScSpecTypeBytesN` espera string hex pura (`02ae…`). Já `Address` é aceito como
`G…` normalmente.

**Workaround:** serializar `BytesN` sem prefixo (é o que
`scripts/serialize-proof.mjs` faz), apesar de `toHex32()` dos scripts off-chain
usarem `0x` para leitura humana.

### F11. Tuplas não valem como argumento nem como retorno de contrato

`get_tally` estava especificado para devolver `(u32, u32)`. No `soroban-sdk` 27 a
conversão `Vec<Val>`/`Topics` existe para tuplas (`tuple.rs`), mas **não** há
`IntoVal<Env, Val>` para tuplas — e é esse trait que `IntoValForContractFn`
(exigido pelo macro `#[contractimpl]`) exige. Só `Vec<Val>` e `Topics` têm
`TryFromVal` de tupla.

**Workaround:** `get_tally` devolve o struct `#[contracttype] Tally { gta6, zelda }`,
que é o idioma Soroban para esse caso. A UI lê `{"gta6":…,"zelda":…}`.

### F12. `--embed-vk` regenera as chaves: o ciclo é `build → prove → test-vectors`

Como em F8, `ctg zk build main --embed-vk` faz uma nova dev ceremony **e** reescreve
`src/vk.rs`. Como `vote` verifica contra a VK embutida, qualquer prova ou vetor de
teste antigo passa a ser inválido silenciosamente.

**Workaround:** fluxo fixo e documentado no README:

```bash
npx ctg zk build main --embed-vk && npx ctg zk prove main && node scripts/gen-test-vectors.mjs
```

`scripts/gen-test-vectors.mjs` grava `src/test_vectors.rs` (prova + public signals)
para que `cargo test` seja auto-contido sem depender de `.artifacts/` (gitignored).

### F13. `vk.rs` gerado quebra o `cargo clippy`

O código emitido por `--embed-vk` chama `G1Affine::from_array(&env, …)` com `env`
já sendo `&Env`, gerando 9 avisos `clippy::needless_borrow`. O arquivo é regenerado
a cada build, então editá-lo não adianta.

**Workaround:** `#[allow(clippy::needless_borrow)]` apenas no `mod vk;` — o resto do
crate continua com lint estrito.

### F14. `#[contractevent]` usa o nome do struct em snake_case como tópico

Sem `topics = [...]`, o primeiro tópico do evento `VoteCast` seria `"vote_cast"`
(`to_snake_case()` do identificador), não `"VoteCast"`.

**Workaround:** declarar `#[contractevent(topics = ["VoteCast"], data_format = "single-value")]`
para o tópico ser literalmente `VoteCast` e o payload ser o `u32` do voto.

### F15. `proof.json` rotula a curva como `bls12381` (sem hífen)

`proof.curve` é `"bls12381"`, não `"bls12-381"` (o nome usado em outras partes do
ecossistema, ex. `pot12_final.ptau` do Caatinga).

**Workaround:** checar `curve === "bls12381"` nos scripts de serialização.

