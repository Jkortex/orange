import type { CollectionType } from '@/lib/content'

/*
 * Pagefind 过滤元数据（构建期被 pagefind 索引器读取）：
 * 搜索把「类型 / 分类」下推给索引，而不是取回全部命中再按 URL 前缀猜类型。
 *
 * 约束（Pagefind 规则）：逗号列表中的 inline 过滤（`name:value`）只能放在最后一项，
 * 因此每个过滤值必须独占一个属性。元素无文本内容，不会漏进正文、页内查找或复制结果。
 * 属性无需位于 data-pagefind-body 内，但保持在页面内容里便于排查。
 */
export function PagefindFilters({
  type,
  category,
}: {
  type: CollectionType
  category?: string
}) {
  return (
    <>
      <span data-pagefind-filter={`type:${type}`} aria-hidden="true" />
      {category && <span data-pagefind-filter={`category:${category}`} aria-hidden="true" />}
    </>
  )
}
