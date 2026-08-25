import type { ApartmentPage, PageData } from "@shared/types/page";
import { formatKstDateTime } from "@shared/utils/format";
import { useEffect } from "react";
import { ChartCard } from "@/components/ChartCard";
import { Hero } from "@/components/Hero";
import { ListingList } from "@/components/ListingList";
import { StatCards } from "@/components/StatCards";
import { Timeline } from "@/components/Timeline";
import { Topbar } from "@/components/Topbar";
import { TransactionTable } from "@/components/TransactionTable";
import type { ResolvedTheme } from "@/hooks/useTheme";
import { useTheme } from "@/hooks/useTheme";

function Apartment({ apt, theme }: { apt: ApartmentPage; theme: ResolvedTheme }) {
  return (
    <article>
      <Hero apt={apt} />
      <StatCards apt={apt} />
      <ChartCard apt={apt} theme={theme} />
      <ListingList apt={apt} />
      <Timeline apt={apt} />
      <TransactionTable apt={apt} />
    </article>
  );
}

export function App({ data }: { data: PageData }) {
  const { choice, resolved, cycle } = useTheme();
  const first = data.apartments[0];

  // 탭 제목은 관심 아파트를 따른다 (index.html의 기본값을 덮어쓴다).
  useEffect(() => {
    document.title = first
      ? `${first.name} ${first.targetArea}㎡ · 부동산 모니터`
      : "부동산 모니터";
  }, [first]);

  return (
    <>
      {first && <Topbar apt={first} choice={choice} onCycleTheme={cycle} />}
      <main className="mx-auto max-w-[780px] px-[1.125rem] pb-20">
        {data.apartments.map((apt) => (
          <Apartment key={apt.name} apt={apt} theme={resolved} />
        ))}
        <footer className="pt-5 text-center text-[0.6875rem] tracking-[0.015em] text-faint">
          {formatKstDateTime(new Date(data.generatedAt))} 기준 · 국토교통부 · KB부동산 · 네이버
          부동산
        </footer>
      </main>
    </>
  );
}
