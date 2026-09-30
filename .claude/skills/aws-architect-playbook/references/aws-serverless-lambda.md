# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Non-idempotent batch consumer that fails the whole batch
```python
def handler(event, context):
    db = psycopg.connect(os.environ["DB_URL"])                # new connection per invocation, secret in env var
    for record in event["Records"]:
        order = json.loads(record["body"])
        charge_customer(order)                                # duplicate charges on redelivery
        db.execute("INSERT INTO payments ...", order)
    # any exception makes SQS redeliver every message in the batch
```
**Why it's wrong:**
- One failing message causes the whole batch to be retried, re-charging customers for already processed messages.
- Connections are created per invocation and the database credential is exposed in plaintext configuration.

## Best Practice (How to do it right)

### 1. Powertools batch processing with idempotency (Python)
```python
from aws_lambda_powertools import Logger, Metrics, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType, process_partial_response
from aws_lambda_powertools.utilities.idempotency import (
    DynamoDBPersistenceLayer, IdempotencyConfig, idempotent_function,
)

logger, tracer, metrics = Logger(), Tracer(), Metrics(namespace="Payments")
processor = BatchProcessor(event_type=EventType.SQS)
persistence = DynamoDBPersistenceLayer(table_name=os.environ["IDEMPOTENCY_TABLE"])
config = IdempotencyConfig(event_key_jmespath="order_id", expires_after_seconds=24 * 3600)
payments = PaymentsService.from_env()                        # clients created once per execution environment

@idempotent_function(data_keyword_argument="order", persistence_store=persistence, config=config)
def process_order(order: dict) -> dict:
    return payments.charge(order["order_id"], order["amount"], order["currency"])

def record_handler(record) -> None:
    process_order(order=record.json_body)

@logger.inject_lambda_context(correlation_id_path="Records[0].messageId")
@tracer.capture_lambda_handler
@metrics.log_metrics
def handler(event, context):
    config.register_lambda_context(context)
    return process_partial_response(event=event, record_handler=record_handler, processor=processor, context=context)
```
### 2. Event source mapping with partial failures and DLQ (AWS SAM)
```yaml
PaymentsFunction:
  Type: AWS::Serverless::Function
  Properties:
    Runtime: python3.13
    Architectures: [arm64]
    MemorySize: 512
    Timeout: 20
    ReservedConcurrentExecutions: 50                 # protects the payment provider
    Policies:
      - DynamoDBCrudPolicy: { TableName: !Ref IdempotencyTable }
      - SQSPollerPolicy: { QueueName: !GetAtt PaymentsQueue.QueueName }
    Events:
      Orders:
        Type: SQS
        Properties:
          Queue: !GetAtt PaymentsQueue.Arn
          BatchSize: 10
          FunctionResponseTypes: [ReportBatchItemFailures]
PaymentsQueue:
  Type: AWS::SQS::Queue
  Properties:
    VisibilityTimeout: 120                           # 6x the function timeout
    RedrivePolicy: { deadLetterTargetArn: !GetAtt PaymentsDLQ.Arn, maxReceiveCount: 5 }
```
**Why it's right:**
- Only failed records are retried, and idempotency guarantees each order is charged once even when redelivered.
- Clients are reused, concurrency is capped to protect the dependency, and poison messages end in a DLQ.
- Logging, tracing, and metrics are structured and correlated through Powertools.
