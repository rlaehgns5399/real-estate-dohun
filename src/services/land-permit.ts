import { fetchPermitRange, matchesParcel, recentWindow } from "@/collectors/land-permit";
import { supabase } from "@/db/client";
import type { ApartmentItem, LandPermit } from "@/types";

/** 한 번에 보내는 행 수. 백필은 수천 건이 나올 수 있어 나눠 보낸다. */
const CHUNK = 500;

function toRow(p: LandPermit) {
  return {
    sgg_cd: p.sggCd,
    acc_year: p.accYear,
    acc_no: p.accNo,
    obj_seqno: p.objSeqno,
    lawd_cd: p.lawdCd,
    bobn: p.bobn,
    bubn: p.bubn,
    address: p.address,
    jimok: p.jimok,
    job_gbn_nm: p.jobGbnNm,
    use_purp: p.usePurp,
    permit_date: p.permitDate,
  };
}

/** 마이그레이션 전이라 테이블이 없을 때의 안내 */
function isMissingTable(message: string): boolean {
  return /relation .* does not exist|Could not find the table/i.test(message);
}

/**
 * 허가 내역을 저장한다.
 *
 * 같은 접수번호가 다시 들어오면 덮어쓴다. 허가가 나중에 취소·취하로 바뀌는 경우가
 * 있어서(JOB_GBN_NM은 허가/취하/취소/기타 네 가지다) 최신 상태를 따라가야 한다.
 */
async function savePermits(permits: LandPermit[]): Promise<void> {
  for (let i = 0; i < permits.length; i += CHUNK) {
    const { error } = await supabase
      .from("land_permits")
      .upsert(permits.slice(i, i + CHUNK).map(toRow), {
        onConflict: "sgg_cd,acc_year,acc_no,obj_seqno",
      });

    if (error) {
      if (isMissingTable(error.message)) {
        throw new Error(
          "[permit] land_permits 테이블이 없습니다. " +
            "src/db/migrations/002-land-permits.sql을 Supabase SQL Editor에서 실행하세요.",
        );
      }
      throw new Error(`[permit] 저장 실패: ${error.message}`);
    }
  }
}

/**
 * 한 단지의 허가 내역을 기간만큼 수집해 저장하고, 저장한 건수를 반환한다.
 *
 * 자치구 전체를 받아 우리 필지만 남긴다. 조회가 구 단위로만 되기 때문이고,
 * 저장까지 구 전체를 넣으면 우리가 보지도 않을 행이 연 2천 건씩 쌓인다.
 */
export async function collectPermits(
  apt: ApartmentItem,
  from: Date,
  to: Date,
  verbose = false,
): Promise<LandPermit[]> {
  const parcel = apt.permitParcel;
  if (!parcel) return [];

  const all = await fetchPermitRange(parcel.sggCd, from, to, (b, e, n) => {
    if (verbose) {
      console.log(
        `[permit] ${b.toISOString().slice(0, 10)} ~ ${e.toISOString().slice(0, 10)}: ${n}건`,
      );
    }
  });

  const mine = all.filter((p) => matchesParcel(p, parcel));
  await savePermits(mine);

  const granted = mine.filter((p) => p.jobGbnNm === "허가").length;
  console.log(
    `[permit] ${apt.name}(${parcel.lawdCd} ${Number(parcel.bobn)}): ` +
      `자치구 ${all.length}건 중 이 필지 ${mine.length}건 (허가 ${granted}건) 저장`,
  );

  return mine;
}

/** 매 실행마다 도는 최신화 — 최근 62일 */
export async function updateRecentPermits(apartments: ApartmentItem[]): Promise<void> {
  const { from, to } = recentWindow();

  for (const apt of apartments) {
    if (!apt.permitParcel) continue;
    await collectPermits(apt, from, to);
  }
}
