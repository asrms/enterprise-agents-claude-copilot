# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Policies that exist on paper only
```text
Repository: shop-api, branch main
- Minimum reviewers: 1, "Allow requestors to approve their own changes": on
- Build validation: optional, never expires
- "Bypass policies when pushing": granted to the Contributors group
- Force push: allowed for Contributors
- /.azure-pipelines/ and /infra/ changes: no required reviewers
- Settings changed by hand in the portal, different in each of the 40 repositories
```
**Why it's wrong:**
- Anyone can approve their own change, push directly, or rewrite history, so the policies protect nothing.
- A stale or failed build can be merged, and pipeline or infrastructure changes need no expert review.
- Manual, per-repository settings drift and cannot be audited.

## Best Practice (How to do it right)

### 1. Branch policies as code with the Terraform provider for Azure DevOps
```hcl
locals {
  main_scope = {
    repository_id  = azuredevops_git_repository.api.id
    repository_ref = azuredevops_git_repository.api.default_branch
    match_type     = "Exact"
  }
}

resource "azuredevops_branch_policy_min_reviewers" "main" {
  project_id = azuredevops_project.shop.id
  enabled    = true
  blocking   = true
  settings {
    reviewer_count                         = 2
    submitter_can_vote                     = false
    last_pusher_cannot_approve             = true
    allow_completion_with_rejects_or_waits = false
    on_push_reset_approved_votes           = true
    scope {
      repository_id  = local.main_scope.repository_id
      repository_ref = local.main_scope.repository_ref
      match_type     = local.main_scope.match_type
    }
  }
}

resource "azuredevops_branch_policy_build_validation" "main" {
  project_id = azuredevops_project.shop.id
  enabled    = true
  blocking   = true
  settings {
    display_name        = "PR validation"
    build_definition_id = azuredevops_build_definition.api_pr.id
    valid_duration      = 720
    scope {
      repository_id  = local.main_scope.repository_id
      repository_ref = local.main_scope.repository_ref
      match_type     = local.main_scope.match_type
    }
  }
}

resource "azuredevops_branch_policy_auto_reviewers" "pipelines_and_infra" {
  project_id = azuredevops_project.shop.id
  enabled    = true
  blocking   = true
  settings {
    auto_reviewer_ids  = [azuredevops_group.platform_team.group_id]
    submitter_can_vote = false
    message            = "Pipeline and infrastructure changes require Platform team approval"
    path_filters       = ["/.azure-pipelines/*", "/infra/*"]
    scope {
      repository_id  = local.main_scope.repository_id
      repository_ref = local.main_scope.repository_ref
      match_type     = local.main_scope.match_type
    }
  }
}

resource "azuredevops_branch_policy_comment_resolution" "main" {
  project_id = azuredevops_project.shop.id
  enabled    = true
  blocking   = true
  settings {
    scope {
      repository_id  = local.main_scope.repository_id
      repository_ref = local.main_scope.repository_ref
      match_type     = local.main_scope.match_type
    }
  }
}

resource "azuredevops_branch_policy_merge_types" "main" {
  project_id = azuredevops_project.shop.id
  enabled    = true
  blocking   = true
  settings {
    allow_squash                  = true
    allow_rebase_and_fast_forward = false
    allow_basic_no_fast_forward   = false
    allow_rebase_with_merge       = false
    scope {
      repository_id  = local.main_scope.repository_id
      repository_ref = local.main_scope.repository_ref
      match_type     = local.main_scope.match_type
    }
  }
}
```
**Why it's right:**
- Two independent reviewers are required, votes reset on new pushes, and the last pusher cannot approve.
- A passing, recent build is mandatory, and pipeline and infrastructure paths always require the Platform team.
- Policies are versioned and reviewed like code and can be applied consistently to every repository.

### 2. Checking protection across repositories with the CLI
```bash
for repo_id in $(az repos list --project shop --query "[].id" -o tsv); do
  count=$(az repos policy list --project shop --repository-id "$repo_id" --branch main \
    --query "length([?isBlocking && type.displayName=='Minimum number of reviewers'])" -o tsv)
  [ "$count" -ge 1 ] || echo "Repository $repo_id: main has no blocking reviewer policy"
done
```
**Why it's right:**
- Gaps in protection are reported automatically instead of discovered after an unreviewed change reaches production.
