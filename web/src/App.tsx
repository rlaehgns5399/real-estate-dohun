import type { ApartmentPage, AreaPage, PageData } from "@shared/types/page";
import { lazy, Suspense, useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/Card";
import { Hero } from "@/components/Hero";
import { ListingList } from "@/components/ListingList";
import { RentCard } from "@/components/RentCard";
import { StatCards } from "@/components/StatCards";
import { Timeline } from "@/components/Timeline";
import { Topbar } from "@/components/Topbar";
import { TransactionTable } from "@/components/TransactionTable";
import { useAreaRoute } from "@/hooks/useAreaRoute";
import type { ResolvedTheme } from "@/hooks/useTheme";
import { useTheme } from "@/hooks/useTheme";

/**
 * 차트만 따로 받아온다.
 *
 * chart.js와 zoom 플러그인이 JS 번들의 절반(gzip 69KB)인데, 정작 스크롤해야 보인다.
 * 같이 묶여 있으면 첫 화면에 필요 없는 걸 다 받고 실행할 때까지 아무것도 그려지지 않는다.
 * #root가 비어 있는 구조라 그 대기 시간이 그대로 빈 화면으로 드러난다.
 */
const ChartCard = lazy(() =>
  import("@/components/ChartCard").then((m) => ({ default: m.ChartCard })),
);

/** 차트가 도착하기 전 자리. 높이를 같게 잡아 레이아웃이 밀리지 않게 한다. */
function ChartPlaceholder() {
  return (
    <section className="mb-6">
      <SectionTitle>시세 추이</SectionTitle>
      <Card large className="px-4 pb-[0.9375rem] pt-[1.125rem]">
        <div className="mb-3.5 h-[26px]" />
        <div className="h-[306px] sm:h-[348px]" />
      </Card>
    </section>
  );
}

/**
 * 차트는 마운트 후에만 올린다.
 *
 * 프리렌더된 HTML에는 자리(ChartPlaceholder)만 들어간다. 차트는 캔버스를 직접 만지므로
 * 어차피 서버에서 그릴 수 없고, Suspense 경계를 서버 마크업에 남기면 hydrate 때 React가
 * "서버가 이 경계를 못 끝냈다"(#419)며 경계를 통째로 버리고 다시 그린다. 첫 클라이언트
 * 렌더를 서버와 똑같이 자리만 그리게 맞춰 그 왕복을 없앤다.
 */
function ChartSlot({ area, theme }: { area: AreaPage; theme: ResolvedTheme }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <ChartPlaceholder />;

  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <ChartCard area={area} theme={theme} />
    </Suspense>
  );
}

interface ApartmentProps {
  apt: ApartmentPage;
  area: AreaPage;
  theme: ResolvedTheme;
}

function Apartment({ apt, area, theme }: ApartmentProps) {
  return (
    <article>
      <Hero apt={apt} area={area} />
      {/*
        면적을 바꾸면 key가 바뀌어 아래 섹션들이 새로 마운트된다.
        정렬·펼침·차트 줌 같은 내부 상태가 이전 면적 것을 물고 넘어오지 않는다.
        새로 마운트되는 김에 .swap으로 한 덩어리처럼 갈아 끼운다.
      */}
      <div key={area.area} className="swap">
        <StatCards area={area} />
        <ChartSlot area={area} theme={theme} />
        <ListingList area={area} />
        <RentCard area={area} />
        <Timeline area={area} />
        <TransactionTable area={area} />
      </div>
    </article>
  );
}

export function App({ data }: { data: PageData }) {
  const { choice, resolved, cycle } = useTheme();
  const [routeArea, selectArea] = useAreaRoute();

  // 주소에 적힌 면적을 모든 단지에 똑같이 적용한다. 그 면적이 없는 단지는 첫 면적을 본다.
  const areaOf = (apt: ApartmentPage) =>
    apt.areas.find((a) => a.area === routeArea) ?? apt.areas[0];

  const first = data.apartments[0];
  const firstArea = first ? areaOf(first) : undefined;

  // 탭 제목은 지금 보고 있는 아파트·면적을 따른다 (index.html의 기본값을 덮어쓴다).
  useEffect(() => {
    document.title = firstArea
      ? `${first.name} ${firstArea.area}㎡ · 부동산 모니터`
      : "부동산 모니터";
  }, [first, firstArea]);

  return (
    <>
      {first && firstArea && (
        <Topbar
          apt={first}
          area={firstArea}
          generatedAt={data.generatedAt}
          choice={choice}
          onCycleTheme={cycle}
          onSelectArea={selectArea}
        />
      )}
      <main className="mx-auto max-w-[780px] px-[1.125rem] pb-20">
        {data.apartments.map((apt) => {
          const area = areaOf(apt);
          return area ? <Apartment key={apt.name} apt={apt} area={area} theme={resolved} /> : null;
        })}
        <footer className="pt-5 text-center text-[0.6875rem] tracking-[0.015em] text-faint">
          국토교통부 · KB부동산 · 네이버 부동산
        </footer>
      </main>
    </>
  );
}
