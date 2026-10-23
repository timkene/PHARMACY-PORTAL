import type { Medication } from './types'

export interface ProcedurePrice { medicationLineId: string; procedureCode: string; amount: number }

export function parseMoney(input: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input.trim())) return null
  const value = Number(input)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function procedurePrices(medications: Medication[], values: Record<string, string>): ProcedurePrice[] | null {
  if (!medications.length) return null
  const lines: ProcedurePrice[] = []
  for (const med of medications) {
    if (!med.lineId || !med.procedureCode) return null
    const amount = parseMoney(values[med.lineId] ?? '')
    if (amount === null) return null
    lines.push({ medicationLineId: med.lineId, procedureCode: med.procedureCode, amount })
  }
  return lines
}

export const medicationSubtotal = (lines: ProcedurePrice[]) =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100
