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
 * - areas:           지켜볼 전용면적들. 첫 번째가 페이지 기본 탭이 된다.
 *                    매매·전세·월세를 모두 수집하므로 거래 유형은 지정하지 않는다.
 *                    KB가 주택형을 나눠 놓은 면적(예: 59.94 A / 59.78 B)은
 *                    59 하나로 적으면 수집기가 합쳐서 가져온다.
 */
export const APARTMENT_ITEMS: ApartmentItem[] = [
  {
    name: "강동리엔파크14단지",
    naverComplexId: "134513",
    kbComplexId: "311861",
    address: "서울특별시 강동구 고덕로98길 160",
    regionCode: "11740",
    areas: [{ area: 49, purchasePrice: 89000 }, { area: 59 }],
  },
];
