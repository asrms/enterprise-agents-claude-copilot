# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. At-most-once consumer and processing-time aggregation
```properties
# consumer.properties
enable.auto.commit=true          # offsets committed before the write succeeds: data loss on crash
auto.offset.reset=latest         # a new group silently skips the backlog
```
```java
orders
    .keyBy(o -> o.customerId())
    .window(TumblingProcessingTimeWindows.of(Duration.ofMinutes(5)))   // results depend on arrival time
    .sum("amount")                                                      // no uid, no late-data handling
    .sinkTo(KafkaSink.<Revenue>builder()
        .setBootstrapServers(BROKERS)
        .setRecordSerializer(serializer)
        .setDeliveryGuarantee(DeliveryGuarantee.NONE)                   // duplicates or losses on failure
        .build());
```
**Why it's wrong:**
- Auto-commit and `latest` lose events after crashes or group resets.
- Processing-time windows give different revenue numbers on replay; there is no watermark or late-data path.
- Missing `uid()` makes state incompatible across upgrades; the sink has no delivery guarantee.

## Best Practice (How to do it right)

### 1. Event-time Flink job with exactly-once Kafka sink
```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
env.enableCheckpointing(60_000, CheckpointingMode.EXACTLY_ONCE);   // org.apache.flink.core.execution

KafkaSource<Order> source = KafkaSource.<Order>builder()
    .setBootstrapServers(BROKERS)
    .setTopics("orders.v1")
    .setGroupId("revenue-5m")
    .setProperty("isolation.level", "read_committed")
    .setValueOnlyDeserializer(new OrderDeserializer())
    .build();

WatermarkStrategy<Order> watermarks = WatermarkStrategy
    .<Order>forBoundedOutOfOrderness(Duration.ofSeconds(30))
    .withTimestampAssigner((order, ts) -> order.eventTimeMillis())
    .withIdleness(Duration.ofMinutes(1));

OutputTag<Order> late = new OutputTag<>("late-orders") {};

SingleOutputStreamOperator<Revenue> revenue = env
    .fromSource(source, watermarks, "orders-source").uid("orders-source")
    .keyBy(Order::customerId)
    .window(TumblingEventTimeWindows.of(Duration.ofMinutes(5)))
    .allowedLateness(Duration.ofMinutes(2))
    .sideOutputLateData(late)
    .aggregate(new RevenueAggregate(), new RevenueWindowFunction())
    .uid("revenue-5m-window");

revenue.sinkTo(KafkaSink.<Revenue>builder()
        .setBootstrapServers(BROKERS)
        .setRecordSerializer(KafkaRecordSerializationSchema.builder()
            .setTopic("revenue-5m.v1")
            .setKeySerializationSchema(new RevenueKeySerializer())
            .setValueSerializationSchema(new RevenueSerializer())
            .build())
        .setDeliveryGuarantee(DeliveryGuarantee.EXACTLY_ONCE)
        .setTransactionalIdPrefix("revenue-5m")
        .setProperty("transaction.timeout.ms", "900000")
        .build())
    .uid("revenue-sink");

revenue.getSideOutput(late).sinkTo(lateOrdersSink).uid("late-orders-sink");
env.execute("revenue-5m");
```
**Why it's right:**
- Event time with bounded out-of-orderness and idleness gives reproducible windows; late events are kept in a side output.
- Checkpoints plus a transactional sink and `read_committed` downstream give end-to-end exactly-once results.
- Stable `uid()`s keep state restorable from savepoints across deployments.
