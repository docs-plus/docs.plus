interface IconProps {
  size?: number;
  fill?: string;
  className?: string;
}

export type IconKeys = "Inline" | "Left" | "InlineCenter" | "Right" | "Resize" | "Sun" | "Moon";

export const Inline = ({ size = 22, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 24 24" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M21 7H3V5h18v2zm0 10H3v2h18v-2zM11 9H3v6h8V9z" />
    </svg>
  `;
};

export const InlineCenter = ({
  size = 22,
  fill = "black",
  className = "",
}: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 24 24" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M3 5h18v2H3V5zm0 14h18v-2H3v2zm5-4h8V9H8v6z"/>
    </svg>
  `;
};

export const Left = ({ size = 22, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 24 24" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M3 5h18v2H3V5zm0 14h18v-2H3v2zm0-4h8V9H3v6zm10 0h8v-2h-8v2zm0-4h8V9h-8v2z" />
    </svg>
  `;
};

export const Right = ({ size = 22, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 24 24" width=${size} xmlns="http://www.w3.org/2000/svg" >
        <path d="M21 7H3V5h18v2zm0 10H3v2h18v-2zm0-8h-8v6h8V9zm-10 4H3v2h8v-2zm0-4H3v2h8V9z" />
    </svg>
  `;
};

export const Resize = ({ size = 24, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 20 20" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M17.5 6.25V2.5h-3.75v1.25H6.25V2.5H2.5v3.75h1.25v7.5H2.5v3.75h3.75v-1.25h7.5v1.25h3.75v-3.75h-1.25v-7.5H17.5zM15 3.75h1.25v1.25H15V3.75zM3.75 3.75H5v1.25H3.75V3.75zM5 16.25H3.75v-1.25H5v1.25zM16.25 16.25h-1.25v-1.25h1.25v1.25zM15 13.75h-1.25v1.25H6.25v-1.25H5v-7.5h1.25V5h7.5v1.25H15v7.5z"/>
      <polygon points="10.625,7.5 9.375,7.5 9.375,9.375 7.5,9.375 7.5,10.625 9.375,10.625 9.375,12.5 10.625,12.5 10.625,10.625 12.5,10.625 12.5,9.375 10.625,9.375 "/>
    </svg>
  `;
};

export const Sun = ({ size = 20, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 20 20" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-11a1 1 0 0 0 1-1V1a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1Zm0 12a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1ZM4.343 5.757a1 1 0 0 0 1.414-1.414L4.343 2.929a1 1 0 0 0-1.414 1.414l1.414 1.414Zm11.314 8.486a1 1 0 0 0-1.414 1.414l1.414 1.414a1 1 0 0 0 1.414-1.414l-1.414-1.414ZM4 10a1 1 0 0 0-1-1H1a1 1 0 0 0 0 2h2a1 1 0 0 0 1-1Zm15-1h-2a1 1 0 1 0 0 2h2a1 1 0 0 0 0-2ZM4.343 14.243l-1.414 1.414a1 1 0 1 0 1.414 1.414l1.414-1.414a1 1 0 0 0-1.414-1.414ZM14.95 6.05a1 1 0 0 0 .707-.293l1.414-1.414a1 1 0 1 0-1.414-1.414l-1.414 1.414a1 1 0 0 0 .707 1.707Z"></path>
    </svg>
  `;
};

export const Moon = ({ size = 18, fill = "black", className = "" }: IconProps = {}): string => {
  return `
    <svg fill=${fill} class="${className}" viewBox="0 0 20 20" width=${size} xmlns="http://www.w3.org/2000/svg" >
      <path d="M17.8 13.75a1 1 0 0 0-.859-.5A7.488 7.488 0 0 1 10.52 2a1 1 0 0 0 0-.969A1.035 1.035 0 0 0 9.687.5h-.113a9.5 9.5 0 1 0 8.222 14.247 1 1 0 0 0 .004-.997Z"></path>
    </svg>
  `;
};
