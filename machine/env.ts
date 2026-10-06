import type { Machine } from "./machine";

export interface Env {
  /** One object per Planary account: that player's machines and their seeds. */
  Machine: DurableObjectNamespace<Machine>;
  /** Service binding to planary-casino-api, which owns every player's chips. */
  CASINO: Fetcher;
  /** Shared secret for the casino's internal wallet API. */
  INTERNAL_KEY: string;
  /** planary-auth base URL used to verify player tokens (defaults to https://auth.planary.ch). */
  AUTH_API_URL?: string;
  /** Comma-separated origins allowed to call this worker from a browser. */
  ALLOWED_ORIGINS?: string;
}
