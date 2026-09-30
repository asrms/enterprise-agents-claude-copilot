# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Over-powered generic tools and an unbounded loop
```python
tools = [
    {"name": "sql", "description": "Run SQL", "input_schema": {"type": "object", "properties": {"q": {"type": "string"}}}},
    {"name": "http", "description": "Call any URL", "input_schema": {"type": "object"}},
]

while True:                                                    # no iteration or cost limit
    response = client.messages.create(model=MODEL, max_tokens=2048, tools=tools, messages=messages)
    for block in response.content:
        if block.type == "tool_use":
            result = TOOLS[block.name](**block.input)          # executes whatever the model asked, as admin
            messages.append(tool_result(block.id, str(result)))
```
**Why it's wrong:**
- The model can read or modify any table and call any URL, including via injected instructions in retrieved text.
- Nothing is validated or authorized against the user, and the loop can run forever and burn budget.

## Best Practice (How to do it right)

### 1. Narrow tools with schemas, user-scoped authorization, approvals, and limits
```python
TOOLS = [
    {
        "name": "get_order_status",
        "description": "Look up the status and delivery estimate of one of the current customer's orders. "
                       "Use when the customer asks where an order is. Do not use for refunds.",
        "input_schema": {
            "type": "object",
            "properties": {"order_number": {"type": "string", "pattern": "^SO-[0-9]{4,10}$"}},
            "required": ["order_number"],
            "additionalProperties": False,
        },
    },
    {
        "name": "request_refund",
        "description": "Create a refund request for a delivered order. Requires customer confirmation before it runs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_number": {"type": "string", "pattern": "^SO-[0-9]{4,10}$"},
                "reason": {"type": "string", "enum": ["damaged", "not_received", "wrong_item", "other"]},
            },
            "required": ["order_number", "reason"],
            "additionalProperties": False,
        },
    },
]
CONSEQUENTIAL = {"request_refund"}

async def run_agent(user: User, messages: list, max_steps: int = 8, max_cost_usd: float = 0.50) -> AgentResult:
    for step in range(max_steps):
        response = await llm.create(tools=TOOLS, messages=messages)
        budget.charge(response.usage)
        if budget.spent > max_cost_usd:
            return AgentResult.stopped("budget_exceeded", messages)
        calls = [b for b in response.content if b.type == "tool_use"]
        if not calls:
            return AgentResult.done(response)
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for call in calls:
            try:
                args = validate(call.name, call.input)                     # JSON schema + business rules
                authorize(user, call.name, args)                           # user's permissions, not the agent's
                if call.name in CONSEQUENTIAL and not await confirm_with_user(user, call.name, args):
                    results.append(tool_result(call.id, "The customer declined this action.", is_error=True))
                    continue
                output = await execute(call.name, args, idempotency_key=f"{user.session_id}:{call.id}")
                results.append(tool_result(call.id, json.dumps(output)))
            except ToolInputError as e:
                results.append(tool_result(call.id, f"Invalid input: {e}. Fix the arguments and retry.", is_error=True))
        messages.append({"role": "user", "content": results})
        trace.record(step=step, calls=calls, results=results)
    return AgentResult.stopped("max_steps", messages)
```
**Why it's right:**
- Tools are narrow, strictly typed, and described with when-to-use guidance; there is no generic data or network access.
- Every call is validated and authorized for the current user, consequential actions need confirmation, and writes are idempotent.
- The loop is bounded by steps and cost, errors are returned in a form the model can correct, and each step is traced.
