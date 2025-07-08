interface IconProps {
  size?: number
  fill?: string
}

export const Copy = ({ size = 24, fill = 'rgb(104, 81, 255)' }: IconProps = {}) => {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" height=${size} viewBox="0 -960 960 960" width=${size} fill=${fill}>
            <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
        </svg>
    `
}

export const LinkOff = ({ size = 24, fill = 'rgb(104, 81, 255)' }: IconProps = {}) => {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" height=${size} viewBox="0 -960 960 960" width=${size} fill=${fill}>
          <path d="m770-302-60-62q40-11 65-42.5t25-73.5q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 57-29.5 105T770-302ZM634-440l-80-80h86v80h-6ZM792-56 56-792l56-56 736 736-56 56ZM440-280H280q-83 0-141.5-58.5T80-480q0-69 42-123t108-71l74 74h-24q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h65l79 80H320Z"/>
        </svg>
    `
}

export const Link = ({ size = 24, fill = 'rgb(104, 81, 255)' }: IconProps = {}) => {
  return `
       <svg xmlns="http://www.w3.org/2000/svg" height=${size} viewBox="0 -960 960 960" width=${size} fill=${fill}>
        <path d="M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z"/>
       </svg>
    `
}

export const Pencil = ({ size = 24, fill = 'rgb(104, 81, 255)' }: IconProps = {}) => {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" height=${size} viewBox="0 -960 960 960" width=${size} fill=${fill}>
          <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
        </svg>
    `
}

export const Title = ({ size = 24, fill = 'rgb(104, 81, 255)' }: IconProps = {}) => {
  return `
        <svg xmlns="http://www.w3.org/2000/svg" height=${size} viewBox="0 -960 960 960" width=${size} fill=${fill}>
          <path d="M420-160v-520H200v-120h560v120H540v520H420Z"/>
        </svg>
    `
}
