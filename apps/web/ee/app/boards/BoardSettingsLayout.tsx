import type { ReactNode } from 'react'

// Board settings tabs render their own chrome; the layout only passes children through.
export default function BoardSettingsLayout({ children }: { children?: ReactNode; params?: Promise<any> }) {
  return <>{children}</>
}
