# DEC-DRIVER-MULTI-RESTAURANT — Identidade única e vínculos com múltiplos parceiros

**Data:** 2026-09-01  
**Status:** Aprovada para implementação controlada

## Problema
O modelo atual associa a conta do entregador a um único registro operacional/restaurante. Um entregador já cadastrado no Localix pode trabalhar para outro parceiro, mas não deve precisar criar outra identidade, senha ou conta Auth.

## Contexto
A operação de filas, assignments, turnos, ganhos e tracking já é naturalmente escopada por `driver_id` e `restaurant_id`. O ponto incompatível é a identidade/autenticação, que hoje pressupõe um único contexto operacional por `owner_id`.

## Opções consideradas
1. Criar uma nova conta Auth por parceiro — rejeitada por duplicar identidade, senha e histórico.
2. Transformar imediatamente toda `delivery_drivers` em identidade global e reescrever filas/assignments — rejeitada nesta etapa pelo risco e amplitude da refatoração.
3. Manter `delivery_drivers` como perfil operacional por restaurante e introduzir vínculos multi-restaurante por conta — escolhida por compatibilidade e menor risco.

## Decisão
- O entregador possui **uma única identidade Auth no Localix**.
- A mesma identidade pode possuir vínculos ativos com múltiplos restaurantes.
- `delivery_drivers` continua sendo o perfil operacional escopado ao restaurante nesta fase.
- `driver_restaurant_memberships` registra os vínculos da identidade com os perfis operacionais.
- Por compatibilidade, apenas um perfil operacional fica selecionado por vez usando o `owner_id` já consumido pelo app legado.
- A troca de estabelecimento é bloqueada se o entregador estiver online, na fila ou com entrega ativa.
- Se um parceiro cadastrar CPF **e** telefone já pertencentes a uma conta ativa, o sistema deve reutilizar a identidade existente, sem criar novo Auth user.

## Motivo
Preserva autenticação, histórico e segurança existentes, evita duplicidade de contas e reduz a superfície da mudança em produção. Permite evolução posterior para identidade global explícita sem reescrever imediatamente toda a operação de entrega.

## Impacto
- **Banco:** nova tabela de memberships, triggers de sincronização/reuso e RPC de troca de contexto.
- **RLS/RBAC:** entregador só lê os próprios vínculos; RPC revalida `auth.uid()`.
- **Operação:** um entregador pode trabalhar para vários parceiros, um contexto por vez.
- **Ganhos/assignments/fila:** continuam segregados pelo `driver_id` operacional de cada restaurante.
- **Financeiro:** nenhuma regra de preço, pagamento, split, taxa ou receita é alterada.

## Riscos
- Associação incorreta de identidade: mitigada exigindo coincidência de CPF **e** telefone.
- Troca durante uma entrega: bloqueada server-side.
- Contexto selecionado ficar ambíguo: mitigado mantendo o índice único existente de `delivery_drivers.owner_id` nesta fase.
- Evolução futura para operação simultânea em vários restaurantes exigirá revisão desta decisão.

## Condição para revisão
Revisar quando houver necessidade comprovada de o mesmo entregador permanecer simultaneamente online em mais de um parceiro ou quando a operação justificar separar definitivamente identidade global de perfil operacional.
