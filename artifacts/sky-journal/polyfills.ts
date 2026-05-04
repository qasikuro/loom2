import { randomUUID } from 'expo-crypto';

if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = {};
}
if (typeof (global as any).crypto.randomUUID !== 'function') {
  (global as any).crypto.randomUUID = randomUUID;
}
