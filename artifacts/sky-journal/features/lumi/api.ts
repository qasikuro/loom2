import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { getAuthToken } from '@/context/AppContext';
import { getApiBase } from '@/utils/apiBase';

// Generated endpoints include /api. Preserve the same production/Expo Go host
// selection and resilient Clerk token registry as the app's existing requests.
setBaseUrl(getApiBase().replace(/\/api\/?$/, '') || null);
let accountId: string | null = null;
export function setLumiRequestAccount(userId: string | null | undefined) {
  accountId = userId ?? null;
}
setAuthTokenGetter(async () => {
  const requestAccount = accountId;
  if (!requestAccount) throw new Error('Lumi requires sign-in.');
  for (let attempt = 0; attempt < 40; attempt++) {
    const token = await getAuthToken();
    if (accountId !== requestAccount) throw new Error('The signed-in account changed.');
    if (token) return token;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Your sign-in is not ready. Please try again.');
});

export { converseWithLumi, getLumiState, updateLumiState, clearLumiState } from '@workspace/api-client-react';
