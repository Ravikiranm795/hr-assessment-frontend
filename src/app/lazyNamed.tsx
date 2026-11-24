import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** React.lazy for a NAMED export: `lazyNamed(() => import('./ExamPage'), 'ExamPage')`. Keeps the component's props type. */
export function lazyNamed<M extends Record<string, unknown>, K extends keyof M & string>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<M[K] extends ComponentType<infer P> ? ComponentType<P> : never> {
  return lazy(async () => ({ default: (await load())[name] as ComponentType })) as never
}
