import { AsyncLocalStorage } from 'node:async_hooks';

const requestTokenStorage = new AsyncLocalStorage<string | undefined>();

export function runWithRequestAccessToken<T>(
  token: string | undefined,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return requestTokenStorage.run(token, fn);
}

export function currentRequestAccessToken(): string | undefined {
  return requestTokenStorage.getStore();
}
