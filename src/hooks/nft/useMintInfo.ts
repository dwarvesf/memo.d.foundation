import { useQuery } from '@tanstack/react-query';

interface MintInfo {
  minter: string;
  mintedAt: string;
}

interface MintInfoResponse {
  data: MintInfo[];
}

async function fetchMintInfo(tokenId: string): Promise<MintInfoResponse> {
  const response = await fetch(
    `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`,
  );
  if (!response.ok) throw new Error('Failed to fetch mint info');
  return response.json();
}

export function useMintInfo(tokenId: string | undefined) {
  return useQuery({
    queryKey: ['mintInfo', tokenId],
    queryFn: () => fetchMintInfo(tokenId!),
    enabled: Boolean(tokenId),
    select: data => ({
      collectors: data.data.map(item => item.minter),
      mintInfo: data.data,
    }),
  });
}
