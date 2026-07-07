import { ToolHandler } from '../../types/tool.js';
import { OntapHttpClient } from '../../utils/ontap-http-client.js';
import {
  wrapAsyncJobResponse,
  successResponse,
  errorResponse,
} from '../../utils/ontap-response-utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SvmRecord {
  name: string;
  aggregates?: Array<{ name: string }>;
}

/** Auto-resolves SVM name and aggregate name from the pool's single SVM. */
async function autoResolveSvm(
  client: OntapHttpClient
): Promise<{ svmName: string; aggregateName: string }> {
  const result = await client.get<{ records?: SvmRecord[] }>('/api/svm/svms', {
    ontap_fields: 'name,aggregates',
  });
  const svm = result?.records?.[0];
  if (!svm?.name) {
    throw new Error('Could not auto-resolve SVM. No SVMs found on this pool.');
  }
  const aggregateName = svm.aggregates?.[0]?.name;
  if (!aggregateName) {
    throw new Error(`SVM "${svm.name}" has no aggregates. Cannot auto-resolve aggregate.`);
  }
  return { svmName: svm.name, aggregateName };
}

function asyncSuccessResponse(result: unknown) {
  const wrapped = wrapAsyncJobResponse(result);
  if (wrapped.asyncJobDetected) {
    const payload = { result: wrapped };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  }
  return successResponse(result);
}

// ---------------------------------------------------------------------------
// SVM
// ---------------------------------------------------------------------------

export const ontapSvmListHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);
    const result = await client.get<{ records?: SvmRecord[] }>('/api/svm/svms', {
      ontap_fields: 'name,aggregates',
    });

    const svm = result?.records?.[0];
    const extracted = {
      records: result?.records,
      svmName: svm?.name ?? null,
      aggregateName: svm?.aggregates?.[0]?.name ?? null,
    };
    return successResponse(extracted);
  } catch (err) {
    return errorResponse('ontap_svm_list', err);
  }
};

// ---------------------------------------------------------------------------
// Volumes
// ---------------------------------------------------------------------------

export const ontapVolumeCreateHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, name, size, nasPath } = args;
    let { svmName, aggregateName } = args;

    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    if (!svmName || !aggregateName) {
      const resolved = await autoResolveSvm(client);
      svmName = svmName || resolved.svmName;
      aggregateName = aggregateName || resolved.aggregateName;
    }

    const body: Record<string, unknown> = {
      name,
      svm: { name: svmName },
      aggregates: [{ name: aggregateName }],
      size,
    };

    if (nasPath) {
      body.nas = { path: nasPath };
    }

    const result = await client.post('/api/storage/volumes', body);

    return asyncSuccessResponse(result);
  } catch (err) {
    return errorResponse('ontap_volume_create', err);
  }
};

export const ontapVolumeListHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, maxRecords } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    const queryParams: Record<string, string> = {};
    if (maxRecords !== undefined) queryParams['max_records'] = String(maxRecords);

    const result = await client.get('/api/storage/volumes', queryParams);
    return successResponse(result);
  } catch (err) {
    return errorResponse('ontap_volume_list', err);
  }
};

export const ontapVolumeGetHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, volumeUuid } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);
    const result = await client.get(`/api/storage/volumes/${volumeUuid}`);
    return successResponse(result);
  } catch (err) {
    return errorResponse('ontap_volume_get', err);
  }
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const ontapJobGetHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, jobUuid } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);
    const result = await client.get<{ state?: string; message?: string }>(
      `/api/cluster/jobs/${jobUuid}`
    );
    return successResponse({
      state: result?.state,
      message: result?.message,
      ...result,
    });
  } catch (err) {
    return errorResponse('ontap_job_get', err);
  }
};

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export const ontapSnapshotCreateHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, volumeUuid, name } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);
    const result = await client.post(`/api/storage/volumes/${volumeUuid}/snapshots`, { name });
    return asyncSuccessResponse(result);
  } catch (err) {
    return errorResponse('ontap_snapshot_create', err);
  }
};

export const ontapSnapshotListHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, volumeUuid, maxRecords } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    const queryParams: Record<string, string> = {};
    if (maxRecords !== undefined) queryParams['max_records'] = String(maxRecords);

    const result = await client.get(`/api/storage/volumes/${volumeUuid}/snapshots`, queryParams);
    return successResponse(result);
  } catch (err) {
    return errorResponse('ontap_snapshot_list', err);
  }
};

// ---------------------------------------------------------------------------
// LUNs
// ---------------------------------------------------------------------------

export const ontapLunCreateHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, name, volumeName, size, osType } = args;
    let { svmName } = args;

    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    if (!svmName) {
      const resolved = await autoResolveSvm(client);
      svmName = resolved.svmName;
    }

    const result = await client.post('/api/storage/luns', {
      name,
      svm: { name: svmName },
      location: { volume: { name: volumeName } },
      os_type: osType,
      space: { size },
    });

    return asyncSuccessResponse(result);
  } catch (err) {
    return errorResponse('ontap_lun_create', err);
  }
};

export const ontapLunListHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, maxRecords } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);

    const queryParams: Record<string, string> = {};
    if (maxRecords !== undefined) queryParams['max_records'] = String(maxRecords);

    const result = await client.get('/api/storage/luns', queryParams);
    return successResponse(result);
  } catch (err) {
    return errorResponse('ontap_lun_list', err);
  }
};

export const ontapLunGetHandler: ToolHandler = async (args) => {
  try {
    const { projectId, locationId, storagePoolId, lunUuid } = args;
    const client = OntapHttpClient.create(projectId, locationId, storagePoolId);
    const result = await client.get(`/api/storage/luns/${lunUuid}`);
    return successResponse(result);
  } catch (err) {
    return errorResponse('ontap_lun_get', err);
  }
};
