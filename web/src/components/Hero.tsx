import type { ApartmentPage } from "@shared/types/page";
import { formatEok, formatMonthDay } from "@shared/utils/format";
import { signedEok, signedPct, toneClass } from "@/format";

/**
 * 지금 얼마고, 내 매입가 대비 얼마인가.
 * 매입가를 설정하지 않았으면 최근 실거래가만 크게 보여준다.
 */
export function Hero({ apt }: { apt: ApartmentPage }) {
  const s = apt.summary;

  // 같은 날 여러 건이면 그 중 최고가를 쓰므로, 그 날 얼마에서 얼마까지 팔렸는지 함께 보여준다.
  const sameDay = s.lastDeal
    ? apt.transactions.filter((t) => t.dealDate === s.lastDeal?.dealDate)
    : [];
  const prices = sameDay.map((t) => t.price).sort((a, b) => a - b);
  const spread = prices.length > 1 && prices[0] !== prices[prices.length - 1];

  const basis = !s.lastDeal
    ? "실거래 없음"
    : spread
      ? `${formatMonthDay(s.lastDeal.dealDate)} · ${prices.length}건 ${formatEok(prices[0])}~${formatEok(prices[prices.length - 1])}`
      : `${formatMonthDay(s.lastDeal.dealDate)} 계약`;

  return (
    <header className="pb-7 pt-9">
      {/* 큰 글자일수록 자간이 넓어 보이므로 트래킹을 음수로 조인다 */}
      <h1 className="reveal m-0 text-[clamp(1.5rem,6vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.028em]">
        {apt.name}
      </h1>
      <p className="reveal mt-1.5 text-[0.8125rem] leading-[1.5] tracking-[0.003em] text-muted">
        {apt.targetArea}㎡ {apt.tradeType} · {apt.address} ·{" "}
        <a
          href={apt.naverUrl}
          target="_blank"
          rel="noopener"
          className="border-b border-border text-muted transition-colors duration-150 ease-out-strong hover:border-faint hover:text-text"
        >
          네이버 부동산
        </a>
      </p>

      <div className="reveal reveal-2 mt-7">
        <div className="text-xs font-semibold uppercase tracking-[0.045em] text-muted">
          최근 실거래가
        </div>
        <div className="mt-[0.3125rem] text-[clamp(2.75rem,13vw,3.75rem)] font-bold leading-none tracking-[-0.045em] tabular-nums">
          {s.lastDeal ? formatEok(s.lastDeal.price) : "—"}
        </div>
        <div className="mt-2 text-sm leading-[1.5] tabular-nums text-muted">
          {s.purchasePrice !== null && s.vsPurchase !== null && s.vsPurchasePct !== null ? (
            <>
              매입가 {formatEok(s.purchasePrice)} 대비{" "}
              <b className={`font-semibold ${toneClass(s.vsPurchase)}`}>
                {signedEok(s.vsPurchase)} ({signedPct(s.vsPurchasePct)})
              </b>{" "}
              · {basis}
            </>
          ) : (
            basis
          )}
        </div>
      </div>
    </header>
  );
}
