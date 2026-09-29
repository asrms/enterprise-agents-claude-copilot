# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Collect everything, track everyone, keep forever
```html
<form>
  <input name="email" required>
  <input name="birth_date" required>          <!-- not needed for a newsletter -->
  <input name="phone" required>
  <label><input type="checkbox" name="marketing" checked> Send me offers from partners</label>   <!-- pre-ticked -->
</form>
<script src="https://analytics.example.net/track.js"></script>   <!-- loads before any consent -->
```
```text
Logs: "User alex.doe@example.com (DOB 1985-04-12) signed up from 93.44.12.8"
Retention: none defined; database copied weekly to the test environment
```
**Why it's wrong:**
- Unnecessary data is mandatory, consent is pre-ticked, and tracking starts without consent.
- Personal data flows into logs and test environments, with no retention or deletion.

## Best Practice (How to do it right)

### 1. Minimal collection with granular consent recorded as data
```html
<form>
  <label for="email">Email address</label>
  <input id="email" name="email" type="email" autocomplete="email" required>
  <fieldset>
    <legend>Optional</legend>
    <label><input type="checkbox" name="consent_newsletter"> Send me the monthly newsletter</label>
  </fieldset>
  <p><a href="/privacy">How we use your data</a></p>
</form>
```
```json
{
  "subject_ref": "hmac:7f3a91c2",
  "purpose": "newsletter",
  "granted": true,
  "notice_version": "privacy-notice-2026-06",
  "collected_at": "2026-09-29T09:14:22Z",
  "channel": "web-signup",
  "withdrawn_at": null
}
```
### 2. Processing record entry for the feature
```yaml
processing: newsletter
controller: Example Shop Ltd.
purpose: sending the monthly newsletter
lawful_basis: consent (Art. 6(1)(a))
data_categories: [email]
data_subjects: [newsletter subscribers]
recipients: [email delivery processor (DPA signed, EU region)]
retention: until consent withdrawal + 30 days for suppression list (hashed email only)
transfers: none outside the EEA
security: encryption at rest, access limited to marketing-ops group, access logged
dsr: export and erasure automated via /privacy/requests (erasure propagated to processor via API)
```
**Why it's right:**
- Only the email is collected, consent is unticked, specific, and recorded with the notice version.
- The processing record documents purpose, basis, retention, recipients, and how data subject rights are fulfilled.
