---
name: rails-security
description: "Securing Ruby on Rails applications: authentication with the Rails 8 generator, Devise, or OmniAuth, authorization with Pundit or Action Policy, strong parameters, CSRF protection, output escaping and html_safe pitfalls, SQL injection, content security policy, secure sessions and cookies, encrypted credentials and Active Record encryption, rate limiting, file uploads with Active Storage, and scanning with Brakeman and bundler-audit. Use it when implementing or reviewing security in Rails code."
---

# Skill: Rails Security

## Implementation Rules:
- **[MANDATORY]** Authenticate with a maintained solution (the Rails 8 authentication generator with `has_secure_password`, Devise, or OmniAuth/OIDC for external identity providers), with secure password hashing (bcrypt), session reset on login (`reset_session`), and account lockout or rate limiting for login attempts.
- **[MANDATORY]** Authorize every action with policies (Pundit `authorize @order` with `verify_authorized` after actions, or Action Policy), and scope queries to what the user may see (`policy_scope(Order)` or `current_customer.orders.find(params[:id])`), preventing insecure direct object references.
- **[MANDATORY]** Use strong parameters for all writes; never `permit!` or pass raw `params` to models.
- **[MANDATORY]** Keep CSRF protection enabled for browser sessions (`protect_from_forgery with: :exception` is the default in `ActionController::Base`), using token-based authentication without cookies for pure APIs.
- **[MANDATORY]** Rely on automatic HTML escaping in views; use `sanitize` with an allow-list for user-provided rich text, and never call `html_safe` or `raw` on user input; use `json_escape` or `to_json` in script contexts.
- **[SECURITY]** Prevent SQL injection: hash conditions or placeholders in `where`, `sanitize_sql_like` for LIKE patterns, and allow-lists for dynamic `order` columns.
- **[SECURITY]** Configure a Content Security Policy (`config/initializers/content_security_policy.rb`) with nonces for inline scripts, force SSL in production (`config.force_ssl = true`), and set secure, HttpOnly, SameSite cookies.
- **[SECURITY]** Protect sensitive data: encrypted credentials for secrets, Active Record encryption (`encrypts :national_id, deterministic: false`) for sensitive columns, `filter_parameters` for passwords, tokens, and personal data in logs.
- **[PATTERN]** Rate limit sensitive endpoints with the built-in `rate_limit` in controllers (Rails 7.2+) or Rack::Attack, and use signed or expiring tokens (`generates_token_for`, signed global ids) for password resets and magic links.
- **[FORBIDDEN]** Committing `config/master.key` or production keys, `render inline:` or `send` with user-controlled input, open redirects (`redirect_to params[:url]` without `allow_other_host: false` validation), and deserializing untrusted YAML or Marshal data.
- **[PATTERN]** Handle uploads with Active Storage: validate content type and size (with a validation gem or custom validations), serve private files through authorized, expiring URLs, and process images in background jobs.
- **[TESTING]** Run Brakeman and `bundler-audit` (or `bundle audit`) in CI, and write request specs for authorization (other users' records return 404/403), strong parameter filtering, CSRF behavior, and rate limits.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
