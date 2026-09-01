import type { AreaPage } from "@shared/types/page";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** 단지명 */
  name: string;
  areas: AreaPage[];
  /** 선택된 전용면적 (㎡) */
  selected: number;
  onSelect: (area: number) => void;
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-3 shrink-0 transition-transform duration-200 ease-out-strong ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function options(menu: HTMLElement | null): HTMLButtonElement[] {
  return [...(menu?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
}

/**
 * 상단바의 단지명 겸 면적 선택기.
 *
 * 상단바는 스크롤해도 남으므로 페이지 어디에 있든 면적을 바꿀 수 있다.
 * 면적이 하나뿐이면 고를 게 없으니 그냥 글자로 둔다.
 *
 * 메뉴는 항상 DOM에 두고 data 상태로만 여닫는다. 조건부 렌더링은 나갈 때 애니메이션을
 * 걸 수 없고, 빠르게 두 번 누르면 처음부터 다시 그려진다. 트랜지션은 진행 중인 값에서
 * 이어받으므로 연타해도 끊기지 않는다.
 */
export function AreaMenu({ name, areas, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // 키보드로 닫았으면 포커스를 트리거로 돌려준다 — 안 그러면 문서 맨 앞으로 튄다.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // 열리면 지금 보고 있는 면적에 포커스를 둔다.
  useEffect(() => {
    if (!open) return;
    const items = options(menuRef.current);
    const index = areas.findIndex((a) => a.area === selected);
    items[index < 0 ? 0 : index]?.focus();
  }, [open, areas, selected]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = options(menuRef.current);
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };

    if (event.key === "ArrowDown") move(current + 1);
    else if (event.key === "ArrowUp") move(current - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
  };

  if (areas.length < 2) {
    return (
      <span className="truncate font-semibold text-muted">
        {name} {selected}㎡
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // 누를 때 scale을 주면 제목 글자까지 같이 줄어든다. 배경 틴트로 눌린 걸 알린다.
        className="-ml-2 flex min-w-0 cursor-pointer items-center gap-1 rounded-chip px-2 py-1 font-semibold text-muted transition-colors duration-150 ease-out-strong hover:bg-text/6 hover:text-text active:bg-text/10 aria-expanded:bg-text/6 aria-expanded:text-text"
      >
        <span className="truncate">
          {name} {selected}㎡
        </span>
        <Caret open={open} />
      </button>

      {/*
        트리거 아래 왼쪽 모서리에서 자라 나오게 origin을 맞춘다 (기본값 center는 팝오버에
        거의 항상 틀리다). 들어올 때 180ms, 나갈 때 120ms — 사용자가 결정하는 순간은
        보여주고, 시스템이 치우는 건 빠르게.
      */}
      <div
        ref={menuRef}
        role="listbox"
        aria-label="전용면적"
        inert={!open}
        onKeyDown={onMenuKeyDown}
        className={`absolute left-0 top-full z-30 mt-2 min-w-36 origin-top-left rounded-card border border-border bg-card p-1 shadow-card-lg transition-[opacity,transform] ease-out-strong motion-reduce:translate-y-0 motion-reduce:scale-100 ${
          open
            ? "translate-y-0 scale-100 opacity-100 duration-[180ms]"
            : "pointer-events-none -translate-y-1 scale-[0.96] opacity-0 duration-[120ms]"
        }`}
      >
        {areas.map((area) => (
          <button
            key={area.area}
            type="button"
            role="option"
            aria-selected={area.area === selected}
            onClick={() => {
              onSelect(area.area);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="flex w-full cursor-pointer items-center justify-between gap-4 whitespace-nowrap rounded-[7px] px-2.5 py-1.5 text-left text-[0.8125rem] tracking-[-0.005em] tabular-nums text-muted transition-colors duration-150 hover:bg-text/6 hover:text-text focus-visible:bg-text/6 focus-visible:text-text focus-visible:outline-none aria-selected:font-semibold aria-selected:text-text"
          >
            {area.area}㎡
            <span
              aria-hidden="true"
              className={`text-[0.6875rem] transition-opacity duration-150 ${
                area.area === selected ? "opacity-100" : "opacity-0"
              }`}
            >
              ✓
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
