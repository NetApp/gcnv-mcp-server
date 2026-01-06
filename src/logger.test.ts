import { describe, expect, it, vi, beforeEach } from 'vitest';

const transportMock = vi.fn(() => ({ kind: 'transport' }));
const destinationMock = vi.fn(() => ({ kind: 'destination' }));

const pinoMock = Object.assign(
  vi.fn(() => ({ child: vi.fn(() => ({})) })),
  {
    transport: transportMock,
    destination: destinationMock,
    stdTimeFunctions: { isoTime: () => '' },
  }
);

vi.mock('pino', () => ({ default: pinoMock }));

describe('logger', () => {
  beforeEach(() => {
    transportMock.mockClear();
    destinationMock.mockClear();
    pinoMock.mockClear();
    vi.resetModules();
  });

  it('uses pino.transport in non-production', async () => {
    process.env.NODE_ENV = 'test';
    await import('./logger.js');
    expect(transportMock).toHaveBeenCalledTimes(1);
    expect(destinationMock).not.toHaveBeenCalled();
  });

  it('uses pino.destination in production', async () => {
    process.env.NODE_ENV = 'production';
    await import('./logger.js');
    expect(destinationMock).toHaveBeenCalledTimes(1);
  });
});
