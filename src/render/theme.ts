/**
 * 테마 선택을 담아둘 스토리지.
 *
 * 이 값을 부팅 스크립트(html.ts)와 토글 핸들러(chart-script.ts) 양쪽에서 참조한다.
 * 한쪽만 바꾸면 "저장은 되는데 불러오지 못하는" 상태가 되므로 반드시 여기서 한 번만 정의한다.
 *
 * localStorage라 브라우저를 닫았다 켜도 선택이 유지된다.
 * 저장하지 않으면(=키 없음) 기기 설정을 따라간다.
 */
export const THEME_STORAGE = "localStorage";

/** 저장 키 */
export const THEME_KEY = "theme";
