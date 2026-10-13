import { getGetAppConfigQueryKey, useGetAppConfig } from '@workspace/api-client-react';

export function isAiFeatureEnabled(
  config: { features?: { ai?: unknown; image_generation?: unknown } } | null | undefined,
): boolean {
  return config?.features?.ai === true && config.features.image_generation === true;
}

export function useAiFeatureAccess() {
  const query = useGetAppConfig({
    query: {
      queryKey: getGetAppConfigQueryKey(),
      staleTime: 0,
      refetchInterval: 15_000,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  });

  return {
    enabled: isAiFeatureEnabled(query.data),
    loading: query.isLoading,
    hasError: query.isError,
    retry: query.refetch,
  };
}
