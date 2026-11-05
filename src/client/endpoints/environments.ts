import type { components } from '@/client/generated/openapi'
import type { EndpointKey, RequestSpec } from '@/client/request'

type PushEnvironmentRequestBody = components['schemas']['PushEnvironmentRequestBody']

export function listEnvironments(siteId: string): RequestSpec {
  return {
    endpoint: 'GET /sites/{site_id}/environments',
    method: 'GET',
    path: `/sites/${encodeURIComponent(siteId)}/environments`,
  }
}

export function pushEnvironment(siteId: string, body: PushEnvironmentRequestBody): RequestSpec {
  return {
    endpoint: 'PUT /sites/{site_id}/environments',
    method: 'PUT',
    path: `/sites/${encodeURIComponent(siteId)}/environments`,
    body,
  }
}

export const ENDPOINTS: EndpointKey[] = ['GET /sites/{site_id}/environments', 'PUT /sites/{site_id}/environments']
