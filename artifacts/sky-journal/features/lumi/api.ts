import {
  clearLumiState as clearLumiStateRequest,
  converseWithLumi as converseWithLumiRequest,
  getLumiState as getLumiStateRequest,
  setBaseUrl,
  updateLumiState as updateLumiStateRequest,
} from '@workspace/api-client-react';
import { getAuthToken } from '@/context/AppContext';
import { getApiBase } from '@/utils/apiBase';

// Generated endpoints include /api. Preserve the same production/Expo Go host
// selection and resilient Clerk token registry as the app's existing requests.
setBaseUrl(getApiBase().replace(/\/api\/?$/, 'async function ensureLumiAuthReady() {
  const requestAccount = accountId;
  if (!requestAccount) throw new Error('Lumi requires sign-in.');
  for (let attempt = 0; attempt < 40; attempt++) {
    const token = await getAuthToken();
    if (accountId !== requestAccount) throw new Error('The signed-in account changed.');
    if (token) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Your sign-in is not ready. Please try again.');
}

function withLumiAuth<TArgs extends unknown[], TResult>(
  request: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    await ensureLumiAuthReady();
    return request(...args);
  };
}

export const converseWithLumi = withLumiAuth(converseWithLumiRequest);
export const getLumiState = withLumiAuth(getLumiStateRequest);
export const updateLumiState = withLumiAuth(updateLumiStateRequest);
export const clearLumiState = withLumiAuth(clearLumiStateRequest);(token) return token;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Your sign-in is not ready. Please try again.');
});

export { converseWithLumi, getLumiState, updateLumiState, clearLumiState } from '@workspace/api-client-react';
