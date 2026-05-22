import { useProjectStore } from '@/components/projects/projectStore'
import { ProjectHeader } from '@/components/projects/ProjectHeader'
import { NewTaskInput } from '@/components/conversations/NewTaskInput'
import { ConversationList } from '@/components/conversations/ConversationList'
import { ArtifactsCard } from '@/components/projects/ArtifactsCard'
import { FolderCard } from '@/components/projects/FolderCard'
import { FilesCard } from '@/components/projects/FilesCard'
import { AiConfigCard } from '@/components/projects/AiConfigCard'

export function ProjectPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === activeProjectId)
  )

  if (!project) return null

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <ProjectHeader project={project} />

      <div className='flex-1 overflow-y-auto'>
        <div className='max-w-6xl mx-auto px-page-x py-page-y'>
          <div className='flex gap-section-gap items-start'>
            {/* Left column — task input + conversation list */}
            <div className='flex-1 min-w-0 flex flex-col gap-section-gap'>
              <NewTaskInput projectId={project.id} />
              <ConversationList projectId={project.id} />
            </div>

            {/* Right column — sidebar cards */}
            <div className='w-86 shrink-0 flex flex-col gap-surface-card'>
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
