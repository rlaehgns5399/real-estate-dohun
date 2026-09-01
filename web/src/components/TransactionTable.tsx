import type { AreaPage, PageTransaction } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { useMemo } from "react";
import { Card, Empty, SectionTitle, TitleNote } from "@/components/Card";
import { Chevron } from "@/components/Chevron";
import { signedEok, toneClass } from "@/format";

/** 처음부터 펼쳐둘 개월 수 */
const OPEN_MONTHS = 2;

const CELL = "whitespace-nowrap px-[0.9375rem] py-[0.3125rem] text-left";

interface MonthGroup {
  month: string;
  rows: PageTransaction[];
}

/** 실거래를 월 단위로 묶는다 — 건수가 늘어도 훑어보기 쉽고, 월별 흐름이 드러난다. */
function groupByMonth(transactions: PageTransaction[]): MonthGroup[] {
  const groups = new Map<string, PageTransaction[]>();
  for (const t of transactions) {
    const month = t.dealDate.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([month, rows]) => ({ month, rows }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function Month({
  group,
  purchase,
  open,
}: {
  group: MonthGroup;
  purchase: number | null;
  open: boolean;
}) {
  const prices = group.rows.map((t) => t.price).sort((a, b) => a - b);
  const avg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const low = prices[0];
  const high = prices[prices.length - 1];
  const range = low === high ? formatEok(low) : `${formatEok(low)} ~ ${formatEok(high)}`;
  const [year, month] = group.month.split("-");

  return (
    <details className="group border-b border-border last:border-b-0" open={open}>
      <summary className="flex items-center gap-3 px-[0.9375rem] py-[0.6875rem] transition-colors duration-150 hover:bg-text/4">
        <span className="text-[0.8125rem] font-[650] tracking-[-0.01em] tabular-nums">
          {year}.{month}
        </span>
        <span className="text-xs tracking-[0.012em] tabular-nums text-muted">
          {group.rows.length}건 · 평균 {formatEok(avg)} · {range}
        </span>
        <Chevron />
      </summary>
      <div className="overflow-x-auto pb-1.5">
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr>
              <th
                className={`${CELL} border-b border-border py-2 text-[0.6875rem] font-semibold tracking-[0.03em] text-muted`}
              >
                계약일
              </th>
              <th
                className={`${CELL} border-b border-border py-2 text-right text-[0.6875rem] font-semibold tracking-[0.03em] text-muted`}
              >
                거래가
              </th>
              <th
                className={`${CELL} border-b border-border py-2 text-right text-[0.6875rem] font-semibold tracking-[0.03em] text-muted`}
              >
                층
              </th>
              {purchase !== null && (
                <th
                  className={`${CELL} border-b border-border py-2 text-right text-[0.6875rem] font-semibold tracking-[0.03em] text-muted`}
                >
                  매입가 대비
                </th>
              )}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {group.rows.map((t) => {
              const vs = purchase !== null ? t.price - purchase : null;
              return (
                <tr key={`${t.dealDate}-${t.price}-${t.floor}`}>
                  <td className={CELL}>{t.dealDate.slice(8).replace(/^0/, "")}일</td>
                  <td className={`${CELL} text-right`}>{formatEok(t.price)}</td>
                  <td className={`${CELL} text-right`}>{t.floor}층</td>
                  {vs !== null && (
                    <td className={`${CELL} text-right ${toneClass(vs)}`}>{signedEok(vs)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TransactionTable({ area }: { area: AreaPage }) {
  const groups = useMemo(() => groupByMonth(area.transactions), [area.transactions]);

  if (groups.length === 0) {
    return (
      <section className="mb-6">
        <SectionTitle>실거래 내역</SectionTitle>
        <Card>
          <Empty>실거래 기록이 없습니다.</Empty>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <SectionTitle>
        실거래 내역{" "}
        <TitleNote>
          {area.transactions.length}건 · {groups.length}개월
        </TitleNote>
      </SectionTitle>
      <Card>
        {groups.map((group, i) => (
          <Month
            key={group.month}
            group={group}
            purchase={area.summary.purchasePrice}
            open={i < OPEN_MONTHS}
          />
        ))}
      </Card>
    </section>
  );
}
