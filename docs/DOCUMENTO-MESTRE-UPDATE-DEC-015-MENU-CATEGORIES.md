# Documento Mestre — Atualização DEC-015

## Hierarquia de categorias no cardápio

**Data:** 2026-10-13  
**Origem:** DEC-015  
**Status:** Implementada — PASS TÉCNICO CONTROLADO

O Localix Delivery passa a suportar uma hierarquia de cardápio limitada a dois níveis:

```text
Categoria principal
└── Subcategoria
    └── Produtos
```

Regras oficiais:

- categoria principal pode possuir nome, foto e descrição breve;
- subcategoria pertence obrigatoriamente a uma categoria principal do mesmo restaurante;
- não é permitido terceiro nível;
- categorias existentes permanecem categorias principais;
- produtos existentes não são migrados automaticamente;
- `menu_items.category_id` permanece como vínculo canônico do produto;
- produtos podem permanecer diretamente na categoria principal quando não houver necessidade de subcategoria;
- a vitrine pública exibe categoria principal com foto, nome e descrição e agrupa produtos por subcategoria quando houver;
- a categoria principal continua pública quando houver item ativo apenas em uma subcategoria;
- exclusão não deve apagar produtos em cascata;
- a hierarquia é metadado de catálogo e não altera preço, checkout, pagamento, split ou benefícios.

Componentes financeiros e de pedido permanecem autoritativos e independentes da hierarquia:
- Checkout;
- OrderService;
- PricingEngine;
- PaymentService;
- Mercado Pago;
- taxa de serviço;
- Localix Benefits.

Limitação de validação:

**Não foi possível provar.** Ainda falta executar um pedido E2E real pela interface utilizando um produto em subcategoria para fechar a validação operacional completa do checkout.

Esta atualização deve ser incorporada ao Documento Mestre consolidado na próxima revisão documental.
