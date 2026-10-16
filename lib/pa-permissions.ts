/** UI capabilities only. Every backend operation independently authorizes staff. */
export const PA_PERMISSIONS = [
  'PA_PREPARATION_READ', 'PA_PREPARATION_WRITE', 'PA_MAPPING_EXPORT', 'PA_MAPPING_IMPORT',
  'PA_MAPPING_REVIEW', 'PA_MAPPING_APPROVE', 'PA_MAPPING_ACTIVATE', 'PA_CATALOG_READ',
  'PA_CATALOG_INGEST', 'PA_CATALOG_VALIDATE', 'PA_CATALOG_TRUST',
] as const
export type PaPermission = typeof PA_PERMISSIONS[number]
const allowed = new Set<string>(PA_PERMISSIONS)

export function parsePaPermissions(value: unknown): PaPermission[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is PaPermission => typeof item === 'string' && allowed.has(item)))].sort()
}
export function hasPaPermission(permissions: unknown, permission: PaPermission): boolean {
  return parsePaPermissions(permissions).includes(permission)
}
export function hasAnyPaPermission(permissions: unknown, needed: readonly PaPermission[]): boolean {
  return needed.some(permission => hasPaPermission(permissions, permission))
}
export const PA_NAVIGATION = [
  { key: 'preparation', label: 'PA Preparation', permissions: ['PA_PREPARATION_READ'] },
  { key: 'mapping-transfer', label: 'Mapping Review Files', permissions: ['PA_MAPPING_EXPORT', 'PA_MAPPING_IMPORT'] },
  { key: 'mapping-proposals', label: 'Mapping Proposals', permissions: ['PA_MAPPING_REVIEW'] },
  { key: 'catalog', label: 'Procedure Catalog', permissions: ['PA_CATALOG_READ'] },
] as const
export function paNavigation(permissions: unknown) {
  return PA_NAVIGATION.filter(item => hasAnyPaPermission(permissions, item.permissions))
}
