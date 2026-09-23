# Season 09 — Kafka Deep Dive

Kafka internals cho Go backend: partition, producer/consumer, replication, rebalancing, idempotency, transactions, KRaft, observability và franz-go.

- Lessons: 18
- Entry point: `index.html`
- Format: static self-contained HTML (no external assets required)

## Lessons

01. Kafka là distributed append-only log, không chỉ là queue — `01-kafka-mental-model.html`
02. Broker, Topic, Partition và Offset — `02-topic-partition-offset.html`
03. Producer internals: batch, linger và compression — `03-producer-pipeline.html`
04. Message key và partitioning strategy — `04-keys-partitioning.html`
05. Replication, ISR, acks và durability — `05-replication-isr-acks.html`
06. Idempotent Producer và duplicate do retry — `06-idempotent-producer.html`
07. Consumer: fetch, position và committed offset — `07-consumer-fetch-offset.html`
08. Consumer Group và parallelism — `08-consumer-groups.html`
09. Rebalance: ownership partition thay đổi như thế nào? — `09-rebalancing.html`
10. Commit semantics và idempotent consumer — `10-commit-semantics.html`
11. Ordering: Kafka đảm bảo cái gì và không đảm bảo cái gì — `11-ordering-guarantees.html`
12. Retry, poison event và Dead Letter Queue — `12-retry-dlq.html`
13. Kafka Transactions và Exactly-Once Semantics — `13-transactions-eos.html`
14. Retention và Log Compaction — `14-retention-compaction.html`
15. Schema Evolution: event sống lâu hơn code — `15-schema-evolution.html`
16. KRaft: metadata quorum và controller — `16-kraft.html`
17. Lag, Capacity và Share Groups trong Kafka 4.x — `17-observability-capacity-share-groups.html`
18. Capstone: Go + franz-go Production Pipeline — `18-go-franz-go-capstone.html`
