import { createElement as h, type ReactElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'

/** 服务端组件渲染为 HTML 字符串（测试共用） */
export async function renderServerComponent(element: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return await new Response(stream).text()
}
