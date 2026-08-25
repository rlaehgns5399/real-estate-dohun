import type { ApartmentPage } from "@shared/types/page";
import { formatEok, formatMonthDay } from "@shared/utils/format";
import { signedEok, signedPct, tone } from "@/format";

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
    <header className="hero">
      <h1 className="reveal reveal-1">{apt.name}</h1>
      <p className="hero-sub reveal reveal-1">
        {apt.targetArea}㎡ {apt.tradeType} · {apt.address} ·{" "}
        <a href={apt.naverUrl} target="_blank" rel="noopener">
          네이버 부동산
        </a>
      </p>
      <div className="hero-stat reveal reveal-2">
        <div className="hero-label">최근 실거래가</div>
        <div className="hero-value">{s.lastDeal ? formatEok(s.lastDeal.price) : "—"}</div>
        <div className="hero-delta">
          {s.purchasePrice !== null && s.vsPurchase !== null && s.vsPurchasePct !== null ? (
            <>
              매입가 {formatEok(s.purchasePrice)} 대비{" "}
              <b className={tone(s.vsPurchase)}>
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
