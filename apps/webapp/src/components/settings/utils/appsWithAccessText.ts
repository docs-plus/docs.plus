export const appsWithAccessText = (count: number): string =>
  count === 0
    ? 'No AI apps can use your account.'
    : `${count} AI ${count === 1 ? 'app' : 'apps'} can use your account.`
