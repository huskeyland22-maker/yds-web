export function naverFinanceUrl(item) {
  if (item?.code) return `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(item.code)}`
  const q = `${item?.name || ""} 주가`
  return `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(q)}`
}
