/**
 * docs.plus brand logo icon.
 *
 * This is the ONLY custom SVG icon that cannot be replaced by a standard
 * icon library (Lucide, react-icons) — it contains brand-specific gradients
 * and paths that define the product identity.
 *
 * All other UI icons must use Lucide (`react-icons/lu`) per the design system §3.5.
 */

interface DocsPlusIconProps {
  size?: number
  className?: string
}

// prettier-ignore
export const DocsPlusIcon = ({ size = 24, className = '' }: DocsPlusIconProps) => {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 1954.69 2508.26" width={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient gradientTransform="matrix(1, 0, 0, -1, 0, 2611.91)" gradientUnits="userSpaceOnUse" id="docsplus-grad" x1="1437.7" x2="1437.7" y1="1849.25" y2="1293.48">
          <stop offset="0" stopColor="#1a237e" stopOpacity="0.2" />
          <stop offset="1" stopColor="#1a237e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d="M1088,102.84H162.83C74,102.84,0,176.85,0,265.68V2341.74c0,88.83,74,162.84,162.83,162.84H1576.48c88.83,0,162.83-74,162.83-162.84V757.86L1358.14,484Z" fill="#2678ff" />
      <path d="M1136.1,709.73l603.19,610.62V757.85Z" fill="url(#docsplus-grad)" />
      <rect fill="none" height="974.32" width="974.32" x="980.37" />
      <path d="M1088,102.84V595c0,88.83,74,162.84,162.83,162.84h488.47Z" fill="#8ab5ff" />
      <path d="M162.83,102.84C74,102.84,0,176.85,0,265.68v14.79c0-88.82,74-162.83,162.83-162.83H1088v-14.8Z" fill="#fff" fillOpacity="0.2" />
      <path d="M1576.48,2493.46H162.83C74,2493.46,0,2419.45,0,2330.63v14.79c0,88.83,74,162.84,162.83,162.84H1576.48c88.83,0,162.83-74,162.83-162.84v-14.79C1739.29,2419.43,1665.28,2493.46,1576.48,2493.46Z" fill="#1a237e" fillOpacity="0.2" />
      <path d="M1250.81,757.85C1162,757.85,1088,683.85,1088,595v14.8c0,88.82,74,162.83,162.83,162.83h488.48v-14.8Z" fill="#1a237e" fillOpacity="0.1" />
      <path d="M818.31,1038.23a74.6,74.6,0,0,0-74.6,74.6V1436.6a27.85,27.85,0,0,1-27.85,27.85H392.09a74.61,74.61,0,0,0-74.61,74.61v60a74.61,74.61,0,0,0,74.61,74.61H715.86a27.85,27.85,0,0,1,27.85,27.85v323.77a74.6,74.6,0,0,0,74.6,74.6h60a74.6,74.6,0,0,0,74.6-74.6V1701.48a27.85,27.85,0,0,1,27.85-27.85H1304.5a74.6,74.6,0,0,0,74.6-74.61v-60a74.6,74.6,0,0,0-74.6-74.61H980.73a27.85,27.85,0,0,1-27.85-27.85V1112.83a74.6,74.6,0,0,0-74.6-74.6Z" fill="#fff" fillRule="evenodd" />
      <rect fill="#fff" height="295.67" rx="124.34" width="1095.67" x="314.57" y="1415.09" />
      <rect fill="#fff" height="1095.67" rx="124.34" width="295.67" x="714.57" y="1015.09" />
    </svg>
  )
}
