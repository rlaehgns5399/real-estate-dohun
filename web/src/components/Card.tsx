import type { ReactNode } from "react";

/** 페이지 전반에서 반복되는 카드 표면. 반복되는 유틸리티 묶음을 여기 한 곳에 둔다. */
export function Card({
  children,
  className = "",
  large = false,
}: {
  children: ReactNode;
  className?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`card border border-border bg-card ${
        large ? "rounded-card-lg shadow-card-lg" : "rounded-card shadow-card"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** 섹션 제목. 대문자 + 넓은 트래킹으로 본문과 구분한다. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-[0.6875rem] text-xs font-semibold uppercase tracking-[0.075em] text-muted">
      {children}
    </h2>
  );
}

/** 제목 옆 부가 정보 — 대문자·트래킹을 되돌린다 */
export function TitleNote({ children }: { children: ReactNode }) {
  return <span className="font-normal normal-case tracking-normal text-faint">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-[0.9375rem] py-7 text-center text-[0.8125rem] text-faint">{children}</div>
  );
}
