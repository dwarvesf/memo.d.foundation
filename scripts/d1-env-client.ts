/**
 * Shared Cloudflare D1 HTTP client, factored out of upload-rollups-to-d1.ts
 * (#303) so upload-memo-posts-to-d1.ts can reuse the exact same env-var
 * contract (D1_ACCOUNT_ID / D1_DATABASE_ID / D1_API_TOKEN) instead of a
 * second copy of the same fetch wrapper.
 */

export interface D1Client {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function createD1ClientFromEnv(env: NodeJS.ProcessEnv = process.env): D1Client {
  const accountId = requireEnv(env, 'D1_ACCOUNT_ID');
  const databaseId = requireEnv(env, 'D1_DATABASE_ID');
  const apiToken = requireEnv(env, 'D1_API_TOKEN');
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  return {
    async execute(sql, params = []) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(`D1 query failed: ${res.status} ${JSON.stringify(json?.errors ?? json)}`);
      }
      return json;
    },
  };
}
