interface MockRequestPayload {
  endpoint: string;
  body: unknown;
}

/**
 * Lightweight client used for end-to-end testing with a local mock server.
 * It mirrors the subset of Google NetApp client methods that our tests invoke.
 */
export class MockNetAppClient {
  public readonly auth = {
    async getAccessToken() {
      return 'mock-access-token';
    },
  };

  constructor(private readonly baseUrl: string) {}

  private async post(endpoint: string, payload: unknown): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ endpoint, payload }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(
        `Mock NetApp server error (${response.status} ${response.statusText}) for ${endpoint}: ${message}`,
      );
    }

    const json = await response.json();
    return json.result;
  }

  listStoragePools(payload: unknown): Promise<any> {
    return this.post('listStoragePools', payload);
  }

  listVolumes(payload: unknown): Promise<any> {
    return this.post('listVolumes', payload);
  }

  listSnapshots(payload: unknown): Promise<any> {
    return this.post('listSnapshots', payload);
  }

  listBackups(payload: unknown): Promise<any> {
    return this.post('listBackups', payload);
  }

  listBackupVaults(payload: unknown): Promise<any> {
    return this.post('listBackupVaults', payload);
  }

  listReplications(payload: unknown): Promise<any> {
    return this.post('listReplications', payload);
  }
}

