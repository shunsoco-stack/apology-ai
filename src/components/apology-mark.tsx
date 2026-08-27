type ApologyMarkProps = { className?: string; animated?: boolean };

export function ApologyMark({
  className = "",
  animated = false,
}: ApologyMarkProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      className={`${className} ${animated ? "mark-thinking" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M17 43C17 30.3 27.3 20 40 20s23 10.3 23 23v13a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8V43Z"
        fill="currentColor"
      />
      <path
        d="m26 38 6 3m22-3-6 3"
        stroke="var(--mark-eyes, #e5f1dc)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M31 50c5 4 13 4 18 0"
        stroke="var(--mark-eyes, #e5f1dc)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M13 25 9 21m58 4 4-4M40 13V7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
    </svg>
  );
}
