import { describe, expect, test } from 'bun:test'
import { KinstaClient } from '@/client/KinstaClient'
import { Operation } from '@/client/operations'
import * as sites from '@/client/endpoints/sites'
import * as tools from '@/client/endpoints/tools'
import { fakeKinsta } from '../helpers/fakeKinsta'

function client(routes: Parameters<typeof fakeKinsta>[0]) {
  const fake = fakeKinsta(routes)
  return { fake, client: new KinstaClient({ apiKey: 'k', companyId: 'c1', fetchFn: fake.fetch }) }
}

describe('KinstaClient', () => {
  test('exposes companyId and sends specs with bearer auth', async () => {
    const { fake, client: c } = client({ 'GET /sites': { body: { company: { sites: [] } } } })
    expect(c.companyId).toBe('c1')
    const res = await c.send(sites.listSites(c.companyId, { includeEnvironments: true }))
    expect(res).toEqual({ company: { sites: [] } })
    expect(fake.calls[0]!.headers.get('Authorization')).toBe('Bearer k')
    expect(fake.calls[0]!.url.searchParams.get('company')).toBe('c1')
  })

  test('start returns an Operation for an operation_id response', async () => {
    const { client: c } = client({ 'POST /sites/tools/clear-cache': { status: 202, body: { operation_id: 'op1', message: 'ok' } } })
    const op = await c.start(tools.clearCache('e1'))
    expect(op).toBeInstanceOf(Operation)
    expect(op.id).toBe('op1')
  })

  test('operation wraps an existing id', () => {
    const { client: c } = client({})
    expect(c.operation('op9').id).toBe('op9')
  })
})
