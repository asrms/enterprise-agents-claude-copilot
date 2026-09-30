# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Leading questions and opinion polling
```text
Interview guide:
1. Don't you think our new returns page is much easier?
2. Would you use a feature that prints labels at home?
3. What features should we build next?
Participants: 3 colleagues from the marketing team
Output: "Users love it" (slide 14 of 60)
```
**Why it's wrong:**
- Questions lead participants and ask for predictions and solutions instead of observing real behavior.
- Participants are not representative, and the conclusion has no evidence or link to decisions.

## Best Practice (How to do it right)

### 1. Research plan
```text
Decision:          Should release 1 of self-service returns include printable labels or QR codes at drop-off points?
Research questions: How do customers currently return items? What blocks them at the shipping step?
Methods:           6 remote interviews (recent returners) + usability test of 2 prototypes with 8 participants
Recruiting:        customers who returned an item in the last 60 days; mix of mobile-only users,
                   users without a printer, and 2 screen reader users
Consent:           recording consent form; recordings deleted after 90 days; notes anonymized
Success metrics:   task success for "create a return and get shipping instructions" >= 85%
```
### 2. Neutral guide and synthesized insight
```text
Guide excerpts:
- "Tell me about the last time you sent something back to an online shop. What happened first?"
- "What did you do when you needed to ship the parcel?"
- Task: "You received shoes in the wrong size. Using this prototype, arrange to send them back."

Insight R-07 (confidence: high, 9 of 14 participants)
Customers without a printer abandon or postpone returns when a printed label is required.
Evidence: "I had to go to the library to print it, so I just kept the shoes." (P4); prototype A task success 56% vs prototype B (QR code) 92%.
Decision: offer QR code drop-off in release 1; printed label as secondary option. Linked to RET-13, RET-19.
```
**Why it's right:**
- The study answers a concrete decision with appropriate methods and representative participants, with consent and data handling defined.
- Questions ask about past behavior; the insight is backed by quotes and task data and is linked to backlog decisions.
