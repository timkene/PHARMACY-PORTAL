import type { Medication, Order } from './types'

export const EXPORT_COLUMNS = [
  'Enrollee ID',
  'Procedure Name',
  'Procedure Code',
  'Diagnosis Name',
  'Diagnosis Code',
  'Provider ID',
  'Provider Name',
] as const

export type ExportColumn = typeof EXPORT_COLUMNS[number]
export type ExportCells = Record<ExportColumn, string>

export interface ExportLine {
  key: string
  orderId: string
  createdAt: string
  enrolleeId: string
  providerId: string
  providerName: string
  cells: ExportCells
}

export interface ExportFilters {
  from?: string
  to?: string
  provider?: string
  enrollee?: string
}

function text(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

function formulaSafe(value: string): string {
  if (!value) return ''
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function lineCells(order: Order, medication: Medication): ExportCells {
  return {
    'Enrollee ID': text(order.enrollee?.enrolleeId),
    'Procedure Name': text(medication.name),
    'Procedure Code': text(medication.procedureCode).trim(),
    'Diagnosis Name': text(medication.diagnosis),
    'Diagnosis Code': text(medication.diagnosisCode).trim(),
    'Provider ID': text(order.provider?.providerId),
    'Provider Name': text(order.provider?.providerName),
  }
}

export function flattenOrder(order: Order): ExportLine[] {
  const medications = order.medications ?? []
  return medications.map((medication, index) => {
    const cells = lineCells(order, medication)
    return {
      key: `${order.id}:${medication.lineId ?? `idx:${index}`}`,
      orderId: order.id,
      createdAt: order.createdAt,
      enrolleeId: cells['Enrollee ID'],
      providerId: cells['Provider ID'],
      providerName: cells['Provider Name'],
      cells,
    }
  })
}

export function flattenOrders(orders: Order[]): ExportLine[] {
  return orders.flatMap(flattenOrder)
}

function dayStart(isoDate: string): number | null {
  if (!isoDate) return null
  const stamp = Date.parse(`${isoDate}T00:00:00.000Z`)
  return Number.isNaN(stamp) ? null : stamp
}

function dayEnd(isoDate: string): number | null {
  if (!isoDate) return null
  const stamp = Date.parse(`${isoDate}T23:59:59.999Z`)
  return Number.isNaN(stamp) ? null : stamp
}

export function filterExportLines(lines: ExportLine[], filters: ExportFilters): ExportLine[] {
  const from = filters.from ? dayStart(filters.from) : null
  const to = filters.to ? dayEnd(filters.to) : null
  const provider = (filters.provider ?? '').trim().toLowerCase()
  const enrollee = (filters.enrollee ?? '').trim().toLowerCase()
  return lines.filter(line => {
    const created = Date.parse(line.createdAt)
    if (from != null && (Number.isNaN(created) || created < from)) return false
    if (to != null && (Number.isNaN(created) || created > to)) return false
    if (provider) {
      const haystack = `${line.providerId} ${line.providerName}`.toLowerCase()
      if (!haystack.includes(provider)) return false
    }
    if (enrollee && !line.enrolleeId.toLowerCase().includes(enrollee)) return false
    return true
  })
}

export function selectedOrFiltered(lines: ExportLine[], selectedKeys: ReadonlySet<string>): ExportLine[] {
  if (selectedKeys.size === 0) return lines
  return lines.filter(line => selectedKeys.has(line.key))
}

export function toCsv(lines: ExportLine[]): string {
  const header = EXPORT_COLUMNS.map(csvCell).join(',')
  const body = lines.map(line => EXPORT_COLUMNS.map(column => csvCell(formulaSafe(line.cells[column]))).join(','))
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function toXlsx(lines: ExportLine[]): Uint8Array {
  const rows = [
    EXPORT_COLUMNS.map(xmlEscape),
    ...lines.map(line => EXPORT_COLUMNS.map(column => xmlEscape(formulaSafe(line.cells[column])))),
  ]
  const sheetRows = rows.map((cells, rowIndex) => {
    const xml = cells.map((value, colIndex) =>
      `<c r="${colRef(colIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`).join('')
    return `<row r="${rowIndex + 1}">${xml}</row>`
  }).join('')
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PA Requests" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
  return zipStore([
    { name: '[Content_Types].xml', data: utf8(types) },
    { name: '_rels/.rels', data: utf8(rels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8(sheet) },
  ])
}

function colRef(index: number): string {
  return String.fromCharCode(65 + index)
}

function xmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = utf8(file.name)
    const crc = crc32(file.data)
    const local = new Uint8Array(30 + name.length)
    writeU16(local, 0, 0x4b50)
    writeU16(local, 2, 0x0403)
    writeU16(local, 4, 20)
    writeU32(local, 14, crc)
    writeU32(local, 18, file.data.length)
    writeU32(local, 22, file.data.length)
    writeU16(local, 26, name.length)
    local.set(name, 30)
    chunks.push(local, file.data)
    const central = new Uint8Array(46 + name.length)
    writeU16(central, 0, 0x4b50)
    writeU16(central, 2, 0x0201)
    writeU16(central, 4, 20)
    writeU16(central, 6, 20)
    writeU32(central, 16, crc)
    writeU32(central, 20, file.data.length)
    writeU32(central, 24, file.data.length)
    writeU16(central, 28, name.length)
    writeU32(central, 42, offset)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length + file.data.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  writeU16(end, 0, 0x4b50)
  writeU16(end, 2, 0x0605)
  writeU16(end, 8, files.length)
  writeU16(end, 10, files.length)
  writeU32(end, 12, centralSize)
  writeU32(end, 16, offset)
  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let cursor = 0
  for (const chunk of [...chunks, ...centrals, end]) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}

function writeU16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff
  target[offset + 1] = (value >> 8) & 0xff
}

function writeU32(target: Uint8Array, offset: number, value: number) {
  writeU16(target, offset, value)
  writeU16(target, offset + 2, (value >>> 16) & 0xffff)
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  return crc >>> 0
})

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
