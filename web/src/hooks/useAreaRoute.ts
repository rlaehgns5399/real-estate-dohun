import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

/**
 * 경로에서 전용면적을 읽는다. 루트(BASE)면 null — 기본 면적을 뜻한다.
 *
 * 쿼리(?area=59)가 아니라 경로(/59/)를 쓰는 이유: 면적마다 HTML을 미리 그려 두므로
 * /59/에 실제 파일이 있다. 정적 호스팅에서 SPA 폴백이 필요했던 건 파일 없는 주소를
 * 클라이언트가 처리해야 할 때고, 지금은 그 전제가 사라졌다.
 *
 * 서버(빌드)와 클라이언트가 같은 함수로 같은 경로를 읽으므로 첫 렌더가 정확히 일치한다.
 * 쿼리로 하면 프리렌더된 HTML은 항상 기본 면적이라 /?area=59로 들어왔을 때 49가 잠깐
 * 보였다가 넘어간다.
 */
export function areaFromPath(pathname: string): number | null {
  const rest = pathname.startsWith(BASE)
    ? pathname.slice(BASE.length)
    : pathname.replace(/^\//, "");
  const segment = rest.replace(/\/+$/, "").split("/").pop() ?? "";
  if (!segment || segment === "index.html") return null;

  const area = Number(segment);
  return Number.isFinite(area) ? area : null;
}

/** 기본 면적은 루트에 둔다 — /49/ 대신 / 가 정규 주소다. */
function pathFor(area: number, isDefault: boolean): string {
  return isDefault ? BASE : `${BASE}${area}/`;
}

/**
 * 보고 있는 전용면적을 주소에 남긴다.
 *
 * initialArea는 서버가 그 페이지를 그릴 때 쓴 값과 같아야 한다. 양쪽 다
 * areaFromPath로 구하므로 어긋날 일이 없다.
 */
export function useAreaRoute(
  initialArea: number | null,
): [number | null, (area: number, isDefault: boolean) => void] {
  const [area, setArea] = useState<number | null>(initialArea);

  useEffect(() => {
    // 뒤로/앞으로가기는 popstate로 들어온다.
    const onPopState = () => setArea(areaFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = useCallback((next: number, isDefault: boolean) => {
    const path = pathFor(next, isDefault);
    if (window.location.pathname === path) return; // 히스토리를 헛되이 늘리지 않는다

    window.history.pushState(null, "", path);
    // pushState는 popstate를 내지 않으므로 직접 갱신한다.
    setArea(isDefault ? null : next);
  }, []);

  return [area, select];
}
