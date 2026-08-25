/** details/summary 펼침 표시. 부모 details가 열리면 90도 돈다. */
export function Chevron() {
  return (
    <svg
      className="chev ml-auto size-[13px] shrink-0 text-faint transition-transform duration-200 ease-out-strong group-open:rotate-90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
