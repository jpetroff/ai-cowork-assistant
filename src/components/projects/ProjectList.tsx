import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '@phosphor-icons/react'
import { useProjectStore } from '@/components/projects/projectStore'
import { ProjectCard } from './ProjectCard'
import { ProjectListSkeleton } from './ProjectListSkeleton'
import { Button } from '@/components/ui/button'

export function ProjectList() {
  const navigate = useNavigate()
  const status = useProjectStore((s) => s.status)
  const error = useProjectStore((s) => s.error)
  const projects = useProjectStore((s) => s.projects)
  const create = useProjectStore((s) => s.create)
  const loadAll = useProjectStore((s) => s.loadAll)

  async function handleNewProject() {
    const project = await create()
    if (project) {
      navigate(`/projects/${project.id}`)
    }
  }

  if (status === 'loading') {
    return <ProjectListSkeleton />
  }

  if (status === 'error') {
    return (
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        <p className='text-sm text-destructive'>Failed to load projects.</p>
        {error && <p className='text-xs text-muted-foreground'>{error}</p>}
        <Button variant='outline' size='sm' onClick={loadAll}>
          Retry
        </Button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className='flex flex-col items-center gap-4 py-20 text-center'>
        <p className='text-sm font-medium'>No projects yet</p>
        <p className='text-xs text-muted-foreground max-w-xs'>
          Create your first project to start working with the AI assistant on
          your documents.
        </p>
        <Button onClick={handleNewProject}>
          <PlusIcon weight='bold' />
          New Project
        </Button>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-medium text-muted-foreground'>Projects</h2>
        <Button size='sm' onClick={handleNewProject}>
          <PlusIcon weight='bold' />
          New Project
        </Button>
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
