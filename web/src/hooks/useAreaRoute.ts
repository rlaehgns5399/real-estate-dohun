import { useCallback, useEffect, useState } from "react";

const PARAM = "area";

/** 주소의 ?area=59에서 전용면적을 읽는다. 없거나 숫자가 아니면 null(기본 면적). */
function readParam(): number | null {
  const raw = new URLSearchParams(window.location.search).get(PARAM)?.trim();
  if (!raw) return null;
  const area = Number(raw);
  return Number.isFinite(area) ? area : null;
}

/**
 * 보고 있는 전용면적을 주소에 남긴다.
 *
 * 경로(/59) 대신 쿼리스트링을 쓰는 이유: GitHub Pages에는 "모르는 경로는 index.html을
 * 돌려준다"는 SPA 폴백 설정이 없다. /real-estate-dohun/59로 새로고침하면 서버가 그
 * 경로의 파일을 찾다 404를 주고, JS가 아예 뜨지 않아 클라이언트 라우터가 실행될 기회조차
 * 없다. 쿼리스트링은 파일 경로가 아니라서 서버는 /real-estate-dohun/을 그대로 200으로
 * 내려주고, 라우팅은 온전히 브라우저에서 끝난다.
 */
export function useAreaRoute(): [number | null, (area: number) => void] {
  /*
   * 첫 렌더는 주소를 보지 않고 null(기본 면적)로 시작한다.
   *
   * HTML을 빌드 시점에 미리 렌더하는데, 그때는 방문자가 어떤 주소로 들어올지 알 수 없다.
   * 첫 클라이언트 렌더가 그 마크업과 달라지면 hydrate가 깨지므로, 주소는 마운트된 뒤에
   * 읽는다. ?area=59로 들어오면 49가 잠깐 보였다가 넘어간다.
   */
  const [area, setArea] = useState<number | null>(null);

  useEffect(() => {
    setArea(readParam());

    // 뒤로/앞으로가기는 popstate로 들어온다.
    const onPopState = () => setArea(readParam());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = useCallback((next: number) => {
    if (readParam() === next) return; // 같은 탭을 다시 눌러 히스토리를 늘리지 않는다

    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, String(next));
    window.history.pushState(null, "", url);

    // pushState는 popstate를 내지 않으므로 여기서 직접 갱신해야 한다.
    // 해시와 달리 상태 갱신 경로가 둘(직접 선택 / 히스토리 이동)로 갈리는 건 History API의 구조다.
    setArea(next);
  }, []);

  return [area, select];
}
