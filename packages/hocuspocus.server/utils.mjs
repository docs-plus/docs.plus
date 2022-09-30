export const checkEnvBolean = (env) => env.toLowerCase() === 'true'
export const checkEnvNull = (env) => env.toLowerCase() === 'null' || env.length === 0 ? false : env
