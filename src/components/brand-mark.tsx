type BrandMarkProps = {
  size?: number;
  className?: string;
};

/** Orange JaayKat mark from JAAYKAT V (simplified J monogram). */
export function BrandMark({ size = 36, className = "" }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="JaayKat"
      className={className}
    >
      <rect width="40" height="40" rx="10" fill="#FF4D00" />
      <path
        d="M22.2 9.2c0-.9.7-1.6 1.6-1.6h2.1c.9 0 1.6.7 1.6 1.6v14.6c0 4.4-3.4 7.6-8.1 7.6-4.6 0-7.8-3-7.8-7.1 0-.9.7-1.6 1.6-1.6h2.1c.9 0 1.6.7 1.6 1.6 0 1.7 1.3 2.9 3.1 2.9 1.9 0 3.2-1.3 3.2-3.2V9.2Z"
        fill="#fff"
      />
    </svg>
  );
}
