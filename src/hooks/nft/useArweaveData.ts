import { useQuery } from '@tanstack/react-query';

interface ArweaveMetadata {
  name: string;
  authors: string[];
  image: string;
}

async function fetchArweaveData(id: string): Promise<ArweaveMetadata> {
  const response = await fetch(`https://arweave.net/${id}`);
  if (!response.ok) throw new Error('Failed to fetch Arweave data');
  return response.json();
}

export function useArweaveData(permaStorageId: string | undefined) {
  return useQuery({
    queryKey: ['arweave', permaStorageId],
    queryFn: () => fetchArweaveData(permaStorageId!),
    enabled: Boolean(permaStorageId),
  });
}
