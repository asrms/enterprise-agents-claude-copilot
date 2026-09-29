---
name: estimation-techniques
description: "Estimating software work realistically: relative sizing with story points or t-shirt sizes, Planning Poker, affinity estimation, three-point and PERT estimates, reference class and historical data, probabilistic forecasting with throughput and Monte Carlo simulation, uncertainty ranges, and communicating forecasts instead of commitments. Use it when estimating work, forecasting delivery dates, or reviewing plans."
---

# Skill: Estimation Techniques

## Implementation Rules:
- **[MANDATORY]** Estimate as a team that will do the work, after the item is understood well enough (acceptance criteria and main unknowns known); estimates by a single person or by managers for the team are not accepted as commitments.
- **[PATTERN]** Use relative sizing for backlog items: story points on a modified Fibonacci scale or t-shirt sizes, anchored to reference stories the team knows well; use Planning Poker to surface different assumptions and affinity estimation for large backlogs.
- **[MANDATORY]** Express uncertainty explicitly: give ranges or confidence levels ("between 6 and 9 weeks with 85% confidence"), never a single date without stating the assumptions and risks behind it.
- **[PATTERN]** For larger initiatives, use three-point estimates (optimistic, most likely, pessimistic) or reference class forecasting based on similar past projects, and add explicit buffers for integration, testing, and known risks.
- **[PATTERN]** Forecast delivery from actual flow data: throughput (items finished per week) or velocity history, combined with Monte Carlo simulation on the remaining item count, rather than summing individual estimates.
- **[PATTERN]** Split items that are too large to estimate confidently (above an agreed threshold, for example 13 points) or run a time-boxed spike first.
- **[FORBIDDEN]** Converting story points to hours for individuals, comparing velocity between teams, padding estimates silently, treating early estimates as fixed commitments, and re-estimating completed work to "fix" velocity.
- **[PATTERN]** Re-forecast regularly as work progresses and scope changes, and communicate changes early with the reason (scope added, assumption proven wrong, capacity changed).
- **[PATTERN]** Track estimation accuracy at the aggregate level (forecast vs actual delivery for releases) to calibrate, not to judge individuals.
- **[PATTERN]** Consider #NoEstimates-style approaches for mature teams with stable flow: slice items to similar small sizes and forecast from counts and throughput.
- **[TESTING]** Review forecasts at milestones against actuals, and use retrospectives to identify systematic biases (for example, integration work consistently underestimated).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
