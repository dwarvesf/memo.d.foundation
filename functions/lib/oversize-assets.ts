// Hand-maintained map (unlike _generated-redirect-map.ts) for the small,
// fixed set of assets that exceed Pages' 25 MiB per-file limit and were
// excluded from the `out/` deploy. Each entry's value is the R2 object key
// under the memo-derived bucket (uploaded once via `wrangler r2 object
// put`); functions/_middleware.ts proxies the request through the R2
// binding rather than redirecting, so the bucket doesn't need to be public.
//
// Source file identical across every alias path listed for it (same
// physical file duplicated in public/content/ by the vault export); one R2
// object per distinct file is enough. See
// docs/cf-migration/M4-02-PAGES-CUTOVER-RECORD.md "Deviations and known
// gaps" #2.
export const OVERSIZE_ASSET_MAP: Record<string, string> = {
  '/content/research/assets/builder-design-pattern.pdf':
    'assets/oversize/builder-design-pattern.pdf',
  '/content/research/topics/architecture/assets/builder-design-pattern.pdf':
    'assets/oversize/builder-design-pattern.pdf',
  '/content/playground/topics/architecture/assets/builder-design-pattern.pdf':
    'assets/oversize/builder-design-pattern.pdf',
  '/content/research/topics/blockchain/assets/build_custom_ai_agent_with_elizaos_result.gif':
    'assets/oversize/build_custom_ai_agent_with_elizaos_result.gif',
  '/content/playground/topics/blockchain/assets/build_custom_ai_agent_with_elizaos_result.gif':
    'assets/oversize/build_custom_ai_agent_with_elizaos_result.gif',
};
