'use client'
import type { Bid } from '@/lib/types'

interface BiddingTableProps {
  bids: Bid[]
  reconnecting?: boolean
}

export function BiddingTable({ bids, reconnecting = false }: BiddingTableProps) {
  const sorted = [...bids].sort((a, b) => a.totalPrice - b.totalPrice)

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <h2 className="text-title-md font-semibold text-on-surface">Live Bids</h2>
        {reconnecting && (
          <span className="flex items-center gap-1.5 text-body-sm text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            <span className="material-symbols-outlined text-[14px]">sync</span>
            Reconnecting…
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              {['Aggregator', 'Unit Price', 'Total Quote', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-label-caps text-on-surface-variant uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-body-sm text-on-surface-variant">
                  Waiting for bids…
                </td>
              </tr>
            ) : (
              sorted.map((bid, idx) => (
                <tr
                  key={bid.id}
                  className={`transition-colors ${
                    bid.isCheapest
                      ? 'bg-secondary/5'
                      : idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-body-sm font-semibold text-on-surface">{bid.aggregatorName}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-code-mono text-on-surface">
                    ₦{bid.unitPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-code-mono text-on-surface font-bold">
                    ₦{bid.totalPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {bid.isCheapest ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-caps font-bold bg-secondary/15 text-secondary uppercase tracking-widest">
                        CHEAPEST
                      </span>
                    ) : (
                      <span className="text-body-sm text-on-surface-variant">Competitive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
