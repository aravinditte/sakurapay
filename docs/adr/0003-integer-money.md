# ADR — Integer minor units for money

Status: Accepted (v1 implementation)

**Context.** Binary floating point cannot represent common decimal amounts exactly; rounding drift in a ledger is a correctness bug, not a cosmetic one. The simulator handles currencies (USD, JPY) whose minor-unit conventions differ.

**Decision.** Represent every amount as an integer count of minor units (`amount_minor`, `BigInteger`) with the ISO 4217 currency code stored alongside. No floating point is used anywhere in monetary code paths, and no currency conversion is performed.

**Consequences.** Arithmetic is exact and ledger sums are comparable with `= 0`. API consumers must do their own display formatting (e.g. cents -> dollars). Amount validation is a simple positive-integer check.
