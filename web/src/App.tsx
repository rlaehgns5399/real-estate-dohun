import type { ApartmentPage, AreaPage, PageData } from "@shared/types/page";
import { useEffect } from "react";
import { ChartCard } from "@/components/ChartCard";
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
        <ChartCard area={area} theme={theme} />
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
