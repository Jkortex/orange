/**
 * 正文衬线字体只在渲染 Markdown 的详情视图引入。
 * 根布局仍是全站 UI 字体（HarmonyOS Sans），避免首页/列表首屏额外请求整套分片 CSS。
 */
export function ProseFontLink() {
  return (
    <link
      rel="stylesheet"
      href="https://unpkg.com/lxgw-wenkai-webfont@1.7.0/style.css"
    />
  )
}
