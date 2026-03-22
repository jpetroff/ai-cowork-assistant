import { useProjectStore } from '@/stores/projectStore'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { NewTaskInput } from '@/components/conversations/NewTaskInput'
import { ConversationList } from '@/components/conversations/ConversationList'
import { ArtifactsCard } from '@/components/projects/ArtifactsCard'
import { FolderCard } from '@/components/projects/FolderCard'
import { FilesCard } from '@/components/projects/FilesCard'
import { AiConfigCard } from '@/components/projects/AiConfigCard'

export function ProjectPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const project = useProjectStore((s) => s.projects.find((p) => p.id === activeProjectId))

  if (!project) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProjectHeader project={project} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex gap-6 items-start">
            {/* Left column — task input + conversation list */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              <NewTaskInput projectId={project.id} />
              <ConversationList projectId={project.id} />
            </div>

            {/* Right column — sidebar cards */}
            <div className="w-80 shrink-0 flex flex-col gap-4">
              <ArtifactsCard projectId={project.id} />
              <FolderCard project={project} />
              <FilesCard />
              <AiConfigCard projectId={project.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
