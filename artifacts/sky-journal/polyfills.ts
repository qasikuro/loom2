import { randomUUID } from 'expo-crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (global as any).crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).crypto = {};
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (global as any).crypto.randomUUID !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).crypto.randomUUID = randomUUID;
}
