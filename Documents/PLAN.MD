# Plano de Sprints — Anonymous Goat

## Premissas
- Escopo congelado: votação binária (GTA 6 = `0`, Zelda = `1`), Merkle Tree de profundidade 4, Poseidon, nullifier por `(secret, electionId)`, contrato na Stellar Testnet.
- Duração total: **7 dias**.
- Cada sprint termina com commit/tag, atualização do friction log e uma revisão curta.
- Ferramentas: Caatinga CLI (`npx ctg ...`), Circom/snarkjs, Rust/Soroban, React + Vite, Freighter.

## Visão Geral

| Sprint | Dias | Foco | Entregável principal |
|---|---:|---|---|
| Sprint 1 | Dia 1 | Setup + Circuito ZK | Circuito compilado e prova válida local |
| Sprint 2 | Dias 2–3 | Contrato verificador + deploy | Contrato na testnet aceitando prova válida |
| Sprint 3 | Dias 4–5 | Frontend | Fluxo E2E: conectar carteira, provar e votar |
| Sprint 4 | Dia 6 | Testes automatizados | Prova inválida e voto duplo rejeitados |
| Sprint 5 | Dia 7 | Documentação + demo | README, friction log e vídeo ≤ 3 min |

---

## Sprint 1 — Setup + Circuito ZK (Dia 1)

**Objetivo:** inicializar o projeto com Caatinga e ter uma prova ZK válida gerada localmente.

**Backlog:**
1. Criar repositório, estrutura de pastas e README inicial.
2. Executar `npx ctg zk init anonymous-goat` e `npm install`.
3. Substituir o circuito padrão por `anonymous_goat.circom`:
   - `commitment = Poseidon(secret)`;
   - inclusão na Merkle Tree com `merklePath` e `merkleIndices`;
   - `nullifier = Poseidon(secret, electionId)`;
   - `vote * (vote - 1) === 0`.
4. Criar `input.json` de exemplo com `secret`, caminho de Merkle, `merkleRoot`, `electionId` e `vote`.
5. Rodar `npx ctg zk build main` e a dev ceremony.
6. Rodar `npx ctg zk prove main` e validar a prova localmente.
7. Iniciar o friction log com problemas do Caatinga.

**Critérios de aceite:**
- `ctg zk build main` conclui sem erro.
- Prova local gerada e verificada com sucesso.
- Entradas públicas incluem `merkleRoot`, `electionId`, `nullifier` e `vote`.
- Commit inicial com circuito e scripts.

**Riscos/mitigação:** circuito complexo demais → manter profundidade 4 e Poseidon; testar primeiro com `snarkjs` local.

---

## Sprint 2 — Contrato Verificador + Deploy (Dias 2–3)

**Objetivo:** adaptar o verificador Soroban gerado pelo Caatinga, implantar na testnet e aceitar uma prova válida.

**Backlog:**
- **Dia 2:**
  1. Adaptar o contrato verificador gerado.
  2. Implementar armazenamento: `Admin`, `MerkleRoot`, `ElectionId`, `Nullifiers`, `Tally`.
  3. Implementar `initialize`, `vote` e `get_tally`.
  4. Lógica de `vote`: validar `merkleRoot` e `electionId`, verificar Groth16, checar nullifier não usado, inserir nullifier, incrementar placar e emitir evento.
  5. Adicionar testes unitários básicos.
  6. Rodar `npx ctg build verifier`.
- **Dia 3:**
  7. Deploy: `npx ctg deploy verifier --network testnet --source alice`.
  8. Smoke test de `initialize` e `get_tally`.
  9. Invocar `vote` com a prova gerada no Sprint 1.
  10. Confirmar incremento do placar e registrar contract ID/tx hash.
  11. Atualizar README com o contract ID.

**Critérios de aceite:**
- Contrato compilado e implantado na testnet.
- Prova válida aceita on-chain e placar atualizado.
- Nullifier repetido rejeitado em teste unitário ou smoke test.
- `get_tally` retorna `(u32, u32)` corretamente.

**Artefatos:** contract ID, tx hash do deploy, tx hash do voto válido.

**Riscos/mitigação:** serialização da prova → usar o cliente Caatinga para montar a invocação; problema na dev ceremony → usar fluxo padrão de testnet do Caatinga.

---

## Sprint 3 — Frontend (Dias 4–5)

**Objetivo:** entregar a tela principal com dois cards e fluxo completo de voto anônimo.

**Backlog:**
- **Dia 4:**
  1. Criar app React + Vite.
  2. Aplicar paleta branco (`#FFFFFF`), preto (`#000000`) e dourado (`#D4AF37`).
  3. Criar tela principal com dois cards: GTA 6 e Zelda.
  4. Implementar conexão Freighter.
  5. Exibir estado de conexão, botões de voto e feedback.
- **Dia 5:**
  6. Integrar geração de prova no navegador (`snarkjs` ou `@caatinga/client`).
  7. Montar `input.json` a partir do `secret` e caminho de Merkle do eleitor.
  8. Invocar `vote` via cliente Caatinga após assinatura da carteira.
  9. Atualizar placar após sucesso.
  10. Exibir erros para prova inválida e voto duplo.

**Critérios de aceite:**
- Usuário conecta carteira, escolhe um jogo, gera prova e vota.
- Transação aceita e placar atualizado na UI.
- Tentativa de voto duplo ou prova inválida exibe erro claro.
- Layout segue a paleta definida.

**Riscos/mitigação:** prova lenta no browser → manter árvore pequena; se necessário, gerar prova via script e usar o frontend apenas para submeter, documentando o fallback.

---

## Sprint 4 — Testes Automatizados (Dia 6)

**Objetivo:** demonstrar de forma reproduzível aceitação de prova válida e rejeição de prova inválida/voto duplo.

**Backlog:**
1. Criar script de teste (`npm test` ou `scripts/test.sh`).
2. Teste 1: prova válida → `vote` aceito e placar incrementado.
3. Teste 2: prova inválida → contrato reverte com erro de verificação.
4. Teste 3: voto duplo com mesmo `secret`/`electionId` → segundo voto rejeitado por nullifier já usado.
5. Salvar logs de execução.
6. Documentar comandos no README.

**Critérios de aceite:**
- Script executa do zero e retorna sucesso.
- Logs mostram claramente a rejeição da prova inválida.
- Teste de voto duplo também falha como esperado.

**Artefatos:** script de teste, logs, instruções de reprodução.

---

## Sprint 5 — Documentação + Vídeo + Friction Log (Dia 7)

**Objetivo:** fechar todos os entregáveis do bounty.

**Backlog:**
1. Finalizar README com:
   - arquitetura;
   - instruções reproduzíveis de deploy;
   - comandos Caatinga;
   - modelo de ameaças e limitações;
   - como rodar testes.
2. Finalizar Caatinga friction log.
3. Gravar vídeo demo ≤ 3 min mostrando:
   - conexão da carteira;
   - seleção do jogo;
   - geração da prova;
   - voto aceito;
   - prova inválida rejeitada;
   - voto duplo rejeitado.
4. Publicar repositório e link do vídeo.
5. Revisar checklist final do bounty.

**Critérios de aceite:**
- Repositório público com circuito, contrato, frontend, scripts e testes.
- README reproduzível.
- Vídeo com link público e duração ≤ 3 min.
- Friction log incluído.
- Links de repositório e vídeo prontos para submissão.

---

## Cerimônias e Definition of Done

**Cerimônias curtas:**
- Daily de 15 min no início de cada dia.
- Review + retrospectiva de 15 min ao fim de cada sprint.
- Atualização do friction log ao fim de cada sprint.

**Definition of Done global:**
- Código commitado e reproduzível.
- Critérios de aceite do sprint atendidos.
- Comandos documentados funcionam em ambiente limpo.
- Friction log atualizado.
- Nenhum segredo real ou chave privada commitada.

## Marcos
- **M1 (Dia 1):** prova ZK válida local.
- **M2 (Dia 3):** contrato na testnet aceitando prova válida.
- **M3 (Dia 5):** fluxo E2E no frontend.
- **M4 (Dia 6):** testes de rejeição automatizados.
- **M5 (Dia 7):** submissão completa com README, vídeo e friction log.