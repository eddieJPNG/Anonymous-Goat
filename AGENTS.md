# AGENTS.md — Anonymous Goat

## 1. Visão Geral do Projeto

**Anonymous Goat** é uma dApp de votação anônima na Stellar (Soroban) para eleger o "Melhor Jogo de 2026" entre *GTA 6* (`vote = 0`) e *Zelda: Ocarina of Time Remake* (`vote = 1`).

O eleitor prova via ZK (Circom/Groth16 + Poseidon) que está em uma lista de elegíveis (Merkle Tree, profundidade 4) e que ainda não votou, sem revelar qual identidade controla. O contrato Soroban verifica a prova on-chain, consome um *nullifier* (impede voto duplo) e atualiza o placar público.

**Stack:** Circom + snarkjs · Rust/Soroban via Caatinga CLI · React + Vite · Freighter · Stellar Testnet.

---

## 2. Princípios de Engenharia

1. **Escopo congelado.** Votação binária, Merkle depth 4, Poseidon, nullifier por `(secret, electionId)`. Não adicionar features fora do SDD sem aprovação.
2. **Reprodutibilidade acima de tudo.** Todo comando documentado no README deve funcionar em ambiente limpo.
3. **Segurança por padrão.** Nunca commitar segredos, chaves privadas, `.env` reais ou `secret` de eleitores.
4. **Simplicidade.** Preferir a solução mais simples que atenda ao bounty. Sem over-engineering.
5. **Testnet only.** A *dev ceremony* do Caatinga é aceitável apenas para testnet; documentar essa limitação.

---

## 3. Estrutura do Repositório

```
anonymous-goat/
├── circuits/              # Circuito Circom original
│   ├── anonymous_goat.circom
│   └── input.example.json
├── contracts/
│   └── verifier/          # Contrato Soroban (Rust)
│       ├── src/lib.rs
│       └── Cargo.toml
├── frontend/              # React + Vite
│   ├── src/
│   └── package.json
├── scripts/               # Prova, deploy e testes
│   ├── prove.js
│   ├── deploy.sh
│   └── test.sh
├── docs/
│   ├── THREAT_MODEL.md
│   └── CAATINGA_FRICTION_LOG.md
├── AGENTS.md
├── README.md
└── package.json
```

---

## 4. Convenções de Código

### 4.1 Rust / Soroban
- `cargo fmt` e `cargo clippy` antes de cada commit.
- Funções públicas documentadas com `///`.
- Tratamento de erro explícito; nunca `unwrap()` em caminhos de produção.
- Emitir eventos para ações relevantes (`VoteCast`).

### 4.2 Circom
- Nomes de sinais em `camelCase`.
- Comentários explicando cada restrição.
- Manter o circuito mínimo: apenas as restrições listadas no SDD (commitment, inclusão Merkle, nullifier, voto binário).

### 4.3 TypeScript / React
- ESLint + Prettier.
- Componentes funcionais e hooks.
- Paleta estrita: branco `#FFFFFF`, preto `#000000`, dourado `#D4AF37`.
- Sem dependências não justificadas.

### 4.4 Shell
- `set -euo pipefail` em todos os scripts.
- Variáveis de rede e contract ID parametrizadas.

---

## 5. Convenções de Commit

Formato: `<tipo>(<escopo>): <descrição curta>`

Tipos: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `build`.

Exemplos:
- `feat(circuit): add nullifier derivation`
- `fix(contract): reject reused nullifier`
- `test(e2e): invalid proof rejection`
- `docs(readme): reproducible deploy steps`

Commits atômicos, mensagens em inglês, corpo opcional explicando o "porquê".

---

## 6. Fluxo de Trabalho

1. Trabalhar em branch `feat/<nome>` ou `fix/<nome>`.
2. Abrir PR descrevendo o que mudou e como testar.
3. PRs devem passar por: build, testes e atualização do friction log (se aplicável).
4. Merge apenas com CI verde (ou verificação manual documentada).
5. Tag de marco ao fim de cada sprint (`m1`…`m5`).

---

## 7. Comandos Essenciais

```bash
# Setup
npx ctg zk init anonymous-goat
npm install

# Circuito
npx ctg zk build main
npx ctg zk prove main

# Contrato
npx ctg build verifier
npx ctg deploy verifier --network testnet --source alice

# Testes
npm test
bash scripts/test.sh
```

---

## 8. Regras de Segurança

- **Nunca** commitar `secret`, `.env`, chaves privadas ou arquivos de proving key sensíveis.
- Segredos de eleitores são distribuídos off-chain; nunca armazenar no repositório.
- Contract ID e tx hashes podem ser públicos (testnet).
- Validar entradas públicas (`merkleRoot`, `electionId`) no contrato antes da verificação.
- Rejeitar nullifiers repetidos com erro explícito.

---

## 9. Testes e Qualidade

- Teste obrigatório: prova válida aceita.
- Teste obrigatório: prova inválida rejeitada.
- Teste obrigatório: voto duplo rejeitado.
- Testes unitários Rust para `initialize`, `vote`, `get_tally`.
- Logs de testes salvos em `docs/` quando relevante para o bounty.

---

## 10. Documentação

- README com: arquitetura, instruções reproduzíveis de deploy, comandos Caatinga, modelo de ameaças e como rodar testes.
- `docs/THREAT_MODEL.md`: garantias e limitações.
- `docs/CAATINGA_FRICTION_LOG.md`: dificuldades encontradas com a ferramenta, atualizado ao fim de cada sprint.
- Manter docs sincronizados com o código.

---

## 11. Definition of Done

- Código commitado e reproduzível em ambiente limpo.
- Critérios de aceite do sprint atendidos.
- Testes passando.
- Friction log atualizado (quando aplicável).
- Nenhum segredo commitado.
- PR revisado e merged.

---

## 12. Limitações Conhecidas

- Anonimato depende do tamanho do conjunto de elegíveis (Merkle depth 4 = até 16).
- O endereço que paga a taxa é público; o anonimato é sobre a identidade na lista.
- O voto é público on-chain; o anonimato é do eleitor, não da escolha.
- A *dev ceremony* não é segura para produção.

---

## 13. Contato e Escopo

Dúvidas de escopo devem ser resolvidas antes da implementação. Alterações no circuito, contrato ou fluxo exigem atualização do SDD e aprovação.