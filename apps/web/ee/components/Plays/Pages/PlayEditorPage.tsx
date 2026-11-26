'use client'
import PlaygroundEditor from '@ee/components/Playground/PlaygroundEditor'

// The app route only hands over the playground, token and org courses; the org slug comes from the playground itself.
export default function PlayEditorPage(props: { playground: any; accessToken: string; orgCourses?: any[] }) {
  return <PlaygroundEditor {...(props as any)} orgslug={props.playground?.org_slug || ''} />
}
