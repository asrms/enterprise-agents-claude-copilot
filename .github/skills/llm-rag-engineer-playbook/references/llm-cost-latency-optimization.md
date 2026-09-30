# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Largest model, whole history, variable prefix, unbounded output
```python
def reply(conversation: list[dict], customer: dict, question: str) -> str:
    system = f"Today is {datetime.now()}. Customer record: {json.dumps(customer)}.\n" + POLICY_HANDBOOK   # changes every call
    return client.messages.create(
        model=LARGEST_MODEL,                    # used even for "what are your opening hours?"
        max_tokens=8192,                        # far above what answers need
        system=system,
        messages=conversation + [{"role": "user", "content": question}],   # 200 turns of history
    ).content[0].text
```
**Why it's wrong:**
- The timestamp and customer record at the start of the prompt change every call, so the long handbook is never served from the prompt cache.
- Every request pays for the largest model, the full history, and a huge output allowance, with no measurement of cost.

## Best Practice (How to do it right)

### 1. Routing, trimmed context, cache-friendly prompt layout, and metrics
```python
ROUTES = {"faq": settings.llm.small_model, "account": settings.llm.medium_model, "complex": settings.llm.large_model}

async def reply(conversation: Conversation, customer: CustomerSummary, question: str) -> Reply:
    intent = await classify_intent(question)                          # small, fast model or rules
    model = ROUTES[intent]

    history = conversation.trimmed(max_tokens=2_000)                  # recent turns + running summary
    response = await client.messages.create(
        model=model,
        max_tokens=settings.llm.max_tokens["support_reply"],          # for example 600
        system=[
            {"type": "text", "text": POLICY_HANDBOOK, "cache_control": {"type": "ephemeral"}},   # stable prefix cached
            {"type": "text", "text": RESPONSE_STYLE_RULES},
        ],
        messages=[
            *history,
            {"role": "user", "content": f"<customer>{customer.to_prompt_fields()}</customer>\n{question}"},
        ],
    )
    metrics.record(
        feature="support_reply", model=model, intent=intent,
        input_tokens=response.usage.input_tokens,
        cache_read_tokens=response.usage.cache_read_input_tokens,
        output_tokens=response.usage.output_tokens,
    )
    return Reply.from_response(response)
```
### 2. Offline enrichment through a batch API
```python
requests = [
    {"custom_id": f"ticket-{t.id}", "params": {"model": settings.llm.small_model, "max_tokens": 50,
     "system": CLASSIFY_PROMPT, "messages": [{"role": "user", "content": t.text}]}}
    for t in tickets_to_label
]
batch = await client.messages.batches.create(requests=requests)    # results collected later by a scheduled job
```
**Why it's right:**
- Simple intents go to a small model; history and customer data are limited to what the task needs.
- The large, stable handbook sits first in the prompt with a cache breakpoint, so repeated calls reuse it.
- Output length is bounded per use case, token usage including cache reads is recorded per feature, and bulk work uses the batch API.
