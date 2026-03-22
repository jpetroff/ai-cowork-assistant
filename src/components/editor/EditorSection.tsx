import { ArtifactTitleBar } from './ArtifactTitleBar'
import { EditorPanel } from './EditorPanel'

export function EditorSection() {
  return (
    <div className="flex flex-col h-full min-w-0">
      <ArtifactTitleBar />
      <EditorPanel />
    </div>
  )
}
