---
name: rails-architecture
description: "Maintainable Ruby on Rails applications on current Rails (8.x): following Rails conventions, thin controllers with strong parameters, models with focused responsibilities and concerns used sparingly, service or form objects for complex use cases, Hotwire (Turbo and Stimulus) for interactivity, API mode and serializers, credentials and configuration, and organizing code as the app grows. Use it when building, structuring, or reviewing Rails applications."
---

# Skill: Rails Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Follow Rails conventions first (RESTful resources, standard directory layout, naming), and introduce additional patterns only when complexity requires them; conventions make the codebase understandable to any Rails developer.
- **[MANDATORY]** Keep controllers thin and RESTful: use `before_action` for loading and authorization, strong parameters (`params.expect(...)` in Rails 8, or `require(...).permit(...)`) for every write, and delegate complex workflows to models or plain Ruby objects.
- **[PATTERN]** Keep models focused: validations, associations, scopes, and domain behavior that belongs to the entity; extract multi-model workflows into plain Ruby objects (`app/services/place_order.rb` or domain-named classes with a single public method) and complex forms into form objects including `ActiveModel::Model`.
- **[PATTERN]** Use concerns for genuinely shared behavior with a clear name (`Archivable`, `Searchable`), not as a place to hide large amounts of unrelated model code.
- **[PATTERN]** Build interactive UI with Hotwire: Turbo Drive and Frames for navigation and partial updates, Turbo Streams for real-time updates, and Stimulus controllers for small client-side behavior, before reaching for a separate SPA.
- **[PATTERN]** For JSON APIs, use API-only controllers or namespaces with explicit serialization (Jbuilder, `ActiveModel::Serializer`, Alba, or Blueprinter) that lists exposed attributes, versioned routes, and consistent error responses.
- **[MANDATORY]** Store secrets in encrypted credentials (`bin/rails credentials:edit --environment production`) or environment variables from a secret manager, with the master key never committed; configure per-environment settings in `config/environments/*.rb`.
- **[FORBIDDEN]** Business logic in views or helpers, callbacks with side effects on other aggregates or external systems (emails, API calls in `after_save`), `permit!` on params, and god models with thousands of lines.
- **[PATTERN]** Use callbacks sparingly for data normalization within the model itself, and trigger side effects explicitly from the workflow (or with `after_commit` and background jobs) so they are visible and testable.
- **[PATTERN]** Structure larger applications with namespaces or engines per domain and enforce boundaries with Packwerk where teams need modularity.
- **[TESTING]** Cover models, service objects, and request flows with tests (RSpec or Minitest), and system tests with Capybara for critical Hotwire interactions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
