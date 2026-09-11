import axios from "axios";
import type { LandPermit, PermitParcel } from "@/types";

/**
 * 서울시 부동산정보광장의 토지거래허가 내역.
 *
 * 공식 오픈API가 아니라 화면(land.seoul.go.kr/land/other/contractStatus.do) 뒷단이다.
 * 공공데이터포털에는 지자체별 "구역 지정현황" 파일만 있고 건별 허가 내역은 없다.
 * 인증은 없다 — API 키도 쿠키도 필요 없다.
 */
const URL = "https://land.seoul.go.kr/land/wsklis/getContractList.do";

/**
 * 한 번에 조회 가능한 최대 기간 (일).
 *
 * 이걸 넘기면 에러가 아니라 HTTP 200에 빈 배열이 온다. 그래서 기간을 잘못 잡으면
 * "허가가 없었다"로 조용히 둔갑한다. 경계는 실측했다 — 62일까지 410건, 63일부터 0건.
 */
const MAX_WINDOW_DAYS = 62;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 날짜 → API가 받는 YYYYMMDD */
function ymd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** YYYYMMDD → YYYY-MM-DD */
function isoDate(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

interface PermitRow {
  SGG_CD: string;
  ACC_YEAR: string;
  ACC_NO: string;
  OBJ_SEQNO: string;
  LAWD_CD: string;
  BOBN: string;
  BUBN: string;
  ADDRESS: string;
  JIMOK: string;
  JOB_GBN_NM: string;
  USE_PURP: string;
  HNDL_YMD: string;
}

function parseRow(row: PermitRow): LandPermit {
  return {
    sggCd: row.SGG_CD,
    accYear: row.ACC_YEAR,
    accNo: row.ACC_NO,
    objSeqno: row.OBJ_SEQNO,
    lawdCd: row.LAWD_CD,
    bobn: row.BOBN,
    bubn: row.BUBN,
    address: row.ADDRESS.trim(),
    jimok: row.JIMOK ?? "",
    jobGbnNm: row.JOB_GBN_NM ?? "",
    usePurp: row.USE_PURP ?? "",
    permitDate: isoDate(row.HNDL_YMD),
  };
}

/**
 * 자치구 하나의 허가 내역을 한 창(최대 62일) 조회한다.
 *
 * 기간이 넘치면 호출하지 않고 던진다. 빈 배열을 받아서 "없음"으로 읽는 것보다
 * 실행을 멈추는 편이 낫다 — 어차피 그 결과는 쓸 수 없다.
 */
export async function fetchPermitWindow(
  sggCd: string,
  begin: Date,
  end: Date,
): Promise<LandPermit[]> {
  const spanDays = Math.round((end.getTime() - begin.getTime()) / DAY_MS);
  if (spanDays > MAX_WINDOW_DAYS) {
    throw new Error(
      `[permit] 조회 기간이 ${spanDays}일입니다. 최대 ${MAX_WINDOW_DAYS}일까지만 되고, ` +
        "넘기면 에러 없이 빈 결과가 오므로 호출하지 않습니다.",
    );
  }
  if (spanDays < 0) {
    throw new Error(`[permit] 시작일이 종료일보다 늦습니다: ${ymd(begin)} ~ ${ymd(end)}`);
  }

  const { data } = await axios.post(
    URL,
    new URLSearchParams({ sggCd, beginDate: ymd(begin), endDate: ymd(end) }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 60000 },
  );

  const rows = data?.result;
  if (!Array.isArray(rows)) {
    throw new Error(
      `[permit] ${sggCd} ${ymd(begin)}~${ymd(end)}: 예상치 못한 응답 — ` +
        `${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  return (rows as PermitRow[]).map(parseRow);
}

/** 이 필지의 허가인지 */
export function matchesParcel(permit: LandPermit, parcel: PermitParcel): boolean {
  return (
    permit.lawdCd === parcel.lawdCd && permit.bobn === parcel.bobn && permit.bubn === parcel.bubn
  );
}

/**
 * 기간을 62일 이하 창으로 잘라 전부 훑는다.
 *
 * 62일 제한은 "한 번에 볼 수 있는 폭"이지 "보관 기간"이 아니다. 창을 쪼개면 과거도
 * 읽힌다 — 2023년 자료까지 실제로 나온다. 백필이 가능한 이유다.
 *
 * 창 사이에 간격을 두지 않는다. 경계일이 양쪽 창에 겹쳐 들어오더라도 접수번호로
 * 중복이 제거되므로, 하루라도 빠뜨리는 쪽이 훨씬 나쁘다.
 */
export async function fetchPermitRange(
  sggCd: string,
  from: Date,
  to: Date,
  onWindow?: (begin: Date, end: Date, count: number) => void,
): Promise<LandPermit[]> {
  const collected = new Map<string, LandPermit>();

  let cursor = from;
  while (cursor <= to) {
    const end = new Date(Math.min(cursor.getTime() + MAX_WINDOW_DAYS * DAY_MS, to.getTime()));
    const batch = await fetchPermitWindow(sggCd, cursor, end);
    for (const p of batch) {
      collected.set(`${p.sggCd}|${p.accYear}|${p.accNo}|${p.objSeqno}`, p);
    }
    onWindow?.(cursor, end, batch.length);

    if (end.getTime() >= to.getTime()) break;
    cursor = end;
  }

  return [...collected.values()];
}

/** 오늘 기준 최근 62일 */
export function recentWindow(now = Date.now()): { from: Date; to: Date } {
  const to = new Date(now);
  return { from: new Date(to.getTime() - MAX_WINDOW_DAYS * DAY_MS), to };
}
