import type { ApartmentItem } from "@/types";

/**
 * 관심 아파트 목록
 *
 * - name:            국토교통부 실거래가 API에 나오는 아파트명 (정확히 일치)
 *                    확인: https://rt.molit.go.kr
 * - naverComplexId:  네이버 부동산 URL의 complexNo
 *                    확인: https://new.land.naver.com/complexes/{complexNo}
 * - kbComplexId:     KB부동산 단지코드 (없으면 null)
 *                    확인: https://kbland.kr
 * - address:         주소 (알림 표시용)
 * - regionCode:      법정동코드 앞 5자리
 *                    확인: https://rt.molit.go.kr (지역 선택 시 코드 확인)
 *                    예: 강남구=11680, 서초구=11650, 송파구=11710
 */
export const APARTMENT_ITEMS: ApartmentItem[] = [
  // {
  //   name: "래미안원베일리",
  //   naverComplexId: "102378",
  //   kbComplexId: null,
  //   address: "서울시 서초구 반포대로 00",
  //   regionCode: "11650",
  // },
];
