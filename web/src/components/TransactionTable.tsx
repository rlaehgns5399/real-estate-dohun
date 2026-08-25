import type { ApartmentPage, PageTransaction } from "@shared/types/page";
import { formatEok } from "@shared/utils/format";
import { useMemo } from "react";
import { Chevron } from "@/components/Chevron";
import { signedEok, tone } from "@/format";

/** 처음부터 펼쳐둘 개월 수 */
const OPEN_MONTHS = 2;

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
    <details className="mo-group" open={open}>
      <summary className="mo-row">
        <span className="mo">
          {year}.{month}
        </span>
        <span className="mo-meta">
          {group.rows.length}건 · 평균 {formatEok(avg)} · {range}
        </span>
        <Chevron />
      </summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>계약일</th>
              <th className="num">거래가</th>
              <th className="num">층</th>
              {purchase !== null && <th className="num">매입가 대비</th>}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((t) => {
              const vs = purchase !== null ? t.price - purchase : null;
              return (
                <tr key={`${t.dealDate}-${t.price}-${t.floor}`}>
                  <td>{t.dealDate.slice(8).replace(/^0/, "")}일</td>
                  <td className="num">{formatEok(t.price)}</td>
                  <td className="num">{t.floor}층</td>
                  {vs !== null && <td className={`num ${tone(vs)}`}>{signedEok(vs)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function TransactionTable({ apt }: { apt: ApartmentPage }) {
  const groups = useMemo(() => groupByMonth(apt.transactions), [apt.transactions]);

  if (groups.length === 0) {
    return (
      <section>
        <h2>실거래 내역</h2>
        <div className="card">
          <div className="empty">실거래 기록이 없습니다.</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>
        실거래 내역{" "}
        <span className="h2-note">
          {apt.transactions.length}건 · {groups.length}개월
        </span>
      </h2>
      <div className="card">
        {groups.map((group, i) => (
          <Month
            key={group.month}
            group={group}
            purchase={apt.summary.purchasePrice}
            open={i < OPEN_MONTHS}
          />
        ))}
      </div>
    </section>
  );
}
