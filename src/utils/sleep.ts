/** Delay helper — extracted for testability (tests mock this to eliminate real waits). */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
