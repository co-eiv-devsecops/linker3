# LaunchDarkly Setup

This project uses [LaunchDarkly](https://launchdarkly.com) for feature flag management.

## SDK Details

- **SDK**: Node.js Server SDK (`@launchdarkly/node-server-sdk`)
- **SDK Type**: server-side
- **Key Type**: SDK Key
- **Installed via**: `npm install @launchdarkly/node-server-sdk`
- **Initialization file**: `src/container.ts` (composition root); `waitForInitialization` called in `src/main.ts`

## Configuration

The SDK key is configured via the `LAUNCHDARKLY_SDK_KEY` environment variable.

- **Do not hardcode** the SDK key in source code.
- The key is in `.env` locally (already in `.gitignore`). `npm start` loads `.env` automatically via Node's `--env-file-if-exists` flag.
- When `LAUNCHDARKLY_SDK_KEY` is unset (e.g. in tests or CI), the client falls back to **offline mode** so `createApp()` doesn't throw — flags evaluate to their default value in that case.
- For production, set `LAUNCHDARKLY_SDK_KEY` in the deployment environment (the Oracle Cloud VM's `/opt/linker/.env`, loaded by the systemd `EnvironmentFile` directive).

## Where to Find Things

| What | Where |
|------|-------|
| Feature flags dashboard | https://app.launchdarkly.com/projects/default/flags |
| Project settings | https://app.launchdarkly.com/settings/projects/default |
| Environments | https://app.launchdarkly.com/projects/default/settings/environments |
| API access tokens | https://app.launchdarkly.com/settings/authorization |
| SDK documentation | https://launchdarkly.com/docs/sdk/server-side/node-js |
| LaunchDarkly docs | https://launchdarkly.com/docs |

## How Feature Flags Work in This Project

1. Flags are evaluated using the LaunchDarkly SDK, via the `ldClient` instance created in `src/container.ts` and injected into `Router`.
2. Flag values are fetched from LaunchDarkly based on the evaluation context (currently a static demo user; use a real user/context per request as the app grows).
3. Changes to flags in the dashboard take effect within seconds (server-side SDK uses streaming by default).

### Example: Evaluating a Flag

```typescript
// src/presentation/Router.ts
const context = { kind: "user", key: "demo-user" };
const enabled = await this.ldClient.boolVariation("my-first-flag", context, false);
```

A working demo endpoint is live at `GET /launchdarkly-demo` — returns the current state of `my-first-flag` as JSON. Safe to remove once you no longer need it as a reference.

## Next Steps

### Feature Flag Best Practices
- **Use flags for every new feature**: Wrap new features in flags so you can release and roll back independently of deployments.
- **Clean up temporary flags**: Mark flags as temporary during creation and archive them when no longer needed.
- **Use descriptive flag keys**: e.g., `enable-checkout-v2` instead of `flag-1`.

### Advanced Capabilities
- **[Percentage Rollouts](https://launchdarkly.com/docs/home/targeting-flags/rollouts)** — Gradually roll out features to a percentage of users.
- **[Targeting Rules](https://launchdarkly.com/docs/home/targeting-flags/targeting-rules)** — Target specific users, segments, or contexts.
- **[Experimentation](https://launchdarkly.com/docs/home/about-experimentation)** — Run A/B tests and measure the impact of flag variations.
- **[Guarded Rollouts](https://launchdarkly.com/docs/home/guarded-rollouts)** — Automatically roll back flag changes based on metric guardrails.
- **[Observability](https://launchdarkly.com/docs/home/observability)** — Monitor flag evaluations and SDK performance with built-in telemetry.

### Agent Integration (MCP Server)

This repo's `.mcp.json` already configures the LaunchDarkly hosted MCP server (OAuth, no tokens in config). With it, an agent can:

- Create and manage flags
- Toggle flags on/off across environments
- Set up targeting rules and rollouts
- Find stale/temporary flags ready to archive
- Run experiments

### Useful CLI Commands

If you have `ldcli` installed:

| Command | Description |
|---------|-------------|
| `ldcli flags list --project default` | List all feature flags |
| `ldcli flags toggle-on --project default --environment production --flag FLAG_KEY` | Turn a flag on |
| `ldcli flags create --project default --data '{"name": "My Flag", "key": "my-flag", "kind": "boolean"}'` | Create a new flag |
| `ldcli environments list --project default` | List environments and SDK keys |
