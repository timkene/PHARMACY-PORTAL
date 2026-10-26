/** Order-scoped IssuePa generation and recovery. Separate from the 21 PA admin routes. */
import { apiFetch } from './api'
import type { PaGenerationResult, PaVerifyResult, VerificationResolution } from './pa-types'

const csrf = { 'X-Pharmacy-CSRF': '1' }
const id = (value: string) => encodeURIComponent(value)

export const generatePharmacyPa = (orderId: string, expectedVersion: number) =>
  apiFetch<PaGenerationResult>(`/api/orders/${id(orderId)}/generate-pa`, {
    method: 'POST', headers: csrf, body: JSON.stringify({ expectedVersion }), cache: 'no-store',
  })

export const markPaVerificationRequired = (orderId: string) =>
  apiFetch<PaGenerationResult>(`/api/orders/${id(orderId)}/pa-interruption/mark-verification-required`, {
    method: 'POST', headers: csrf, body: JSON.stringify({}), cache: 'no-store',
  })

export function verificationBody(value: VerificationResolution): VerificationResolution {
  const evidence = value.evidence.trim()
  if (value.resolution === 'existing_pa') {
    return { resolution: 'existing_pa', evidence, paNumber: (value.paNumber ?? '').trim() }
  }
  const shared = {
    evidence,
    verificationMethod: (value.verificationMethod ?? '').trim(),
    checkedWith: (value.checkedWith ?? '').trim(),
    verifiedAt: value.verifiedAt ?? null,
  }
  if (value.resolution === 'confirmed_rejected') {
    return { resolution: 'confirmed_rejected', ...shared }
  }
  return {
    resolution: 'confirmed_no_pa', ...shared,
    confirmNoPaCreated: value.confirmNoPaCreated === true,
    confirmAuthoritativeAbsence: value.confirmAuthoritativeAbsence === true,
    reconciliationReference: (value.reconciliationReference ?? '').trim(),
  }
}

export const verifyPaLine = (orderId: string, lineId: string, body: VerificationResolution) =>
  apiFetch<PaVerifyResult>(`/api/orders/${id(orderId)}/pa-lines/${id(lineId)}/verify`, {
    method: 'POST', headers: csrf, body: JSON.stringify(verificationBody(body)), cache: 'no-store',
  })
