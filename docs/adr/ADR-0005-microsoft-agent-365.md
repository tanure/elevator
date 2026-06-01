# ADR-0005: Microsoft Agent 365 as a first-class connector

- **Status:** Accepted (design only — implementation deferred to M9)
- **Date:** 2026-05-22

## Context

Elevator already ships Microsoft 365 Calendar and Mail connectors that
wrap Microsoft Graph behind OAuth + PKCE. Microsoft is rolling out a
distinct surface — Microsoft 365 *Agents* (a.k.a. "Agent 365") — that is
**not** a Graph wrapper:

- Agents are declared via the Microsoft 365 Agents SDK / Agents Toolkit
  and resolved through Copilot orchestration, not REST CRUD.
- Auth uses Entra ID app registrations with delegated permissions
  scoped to the Agents and Substrate platforms, not just `User.Read`.
- The interaction model is request/response with the agent runtime
  (Teams, Outlook, Copilot Chat) rather than reading user data.

Wrapping that surface as another `m365-*` Graph connector would mix
concerns and force the existing `graphFetch` helper to grow auth modes
it should not own. We also do not yet have a sanctioned tenant for
integration testing.

## Decision

Treat Microsoft Agent 365 as its own connector module
(`m365-agent`) sitting alongside `m365-calendar` and `m365-mail` in
`apps/desktop/src/main/integrations/connectors/`. It will:

1. Carry its own `ConnectorTemplate` describing the Agents config
   (tenant, client id, agent id, optional manifest path).
2. Implement the `Connector` interface like every other module, but
   route through a new helper (e.g. `agentsFetch`) rather than
   `graphFetch`, so token caches and scopes stay isolated.
3. Expose tools that delegate to an Agent — `agent.invoke`,
   `agent.threads.list` — rather than reading user mailboxes or
   calendars.
4. Be **opt-in until M9 ships**: the module is registered only when
   `ELEVATOR_ENABLE_M365_AGENT=1` is set. The scaffold currently
   returns "Not yet implemented" from `check`/`callTool`, so the
   template never appears in the production catalogue.

## Consequences

**Positive**

- Existing Graph connectors stay simple and well-tested.
- Agent-specific scopes, redirect URIs, and orchestration logic live in
  one file. Removing or rewriting the connector later does not touch
  Calendar/Mail.
- The opt-in flag lets us iterate on the design behind a flag without
  shipping a half-built connector to end users.

**Negative**

- Two M365 auth flows to maintain side-by-side (Graph delegated and
  Agents delegated). We accept that cost in exchange for a clean
  separation.
- The scaffold ships dead code until M9 lands. Mitigated by the env
  flag — `listTemplates()` filters it out when disabled.

## Out of scope (tracked for M9)

- Real MSAL device-code or loopback flow for Agents scopes.
- Agent manifest packaging via the Microsoft 365 Agents Toolkit.
- Dashboard cards rendering agent activity.
- End-to-end tests against a real tenant.
