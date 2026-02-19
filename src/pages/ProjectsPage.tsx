import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useProjectsStore } from '@/stores/projects-store'
import { formatDistanceToNow } from 'date-fns'
import { Pencil, Trash2, Plus, FolderOpen } from 'lucide-react'

export function ProjectsPage() {
  const navigate = useNavigate()
  const {
    projects,
    isLoading,
    searchQuery,
    loadProjects,
    createProject,
    deleteProject,
    renameProject,
    setSearchQuery,
  } = useProjectsStore()

  const [isCreating, setIsCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newProjectName.trim()) return
    setIsCreating(true)
    try {
      const id = await createProject(newProjectName.trim())
      setNewProjectName('')
      navigate(`/project/${id}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleRename = async () => {
    if (!renameProjectId || !renameValue.trim()) return
    await renameProject(renameProjectId, renameValue.trim())
    setRenameProjectId(null)
    setRenameValue('')
  }

  const handleDelete = async () => {
    if (!deleteProjectId) return
    await deleteProject(deleteProjectId)
    setDeleteProjectId(null)
  }

  const handleOpenProject = (id: string) => {
    navigate(`/project/${id}`)
  }

  return (
    <div className='flex flex-col h-screen'>
      <header className='flex items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <h1 className='text-lg font-semibold'>Projects</h1>
        <div className='flex items-center gap-2'>
          <Input
            placeholder='Search projects...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-64'
          />
          <Button onClick={() => setNewProjectName('New Project')}>
            <Plus className='size-4' />
            New Project
          </Button>
        </div>
      </header>

      <main className='flex-1 overflow-auto p-6'>
        {isLoading ? (
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            Loading...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-muted-foreground gap-2'>
            <FolderOpen className='size-12 opacity-50' />
            <p>
              {searchQuery
                ? 'No projects match your search'
                : 'No projects yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className='cursor-pointer hover:border-primary/50 transition-colors'
                onClick={() => handleOpenProject(project.id)}
              >
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle
                      className='text-base truncate'
                      title={project.name}
                    >
                      {project.name}
                    </CardTitle>
                    <div className='flex items-center gap-1 shrink-0'>
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameProjectId(project.id)
                          setRenameValue(project.name)
                        }}
                      >
                        <Pencil className='size-3' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteProjectId(project.id)
                        }}
                      >
                        <Trash2 className='size-3 text-destructive' />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Updated{' '}
                    {formatDistanceToNow(project.updated_at, {
                      addSuffix: true,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className='pt-0'>
                  <p className='text-muted-foreground text-xs'>
                    Created{' '}
                    {formatDistanceToNow(project.created_at, {
                      addSuffix: true,
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={() => setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will also
              delete all chats and artifacts within it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!renameProjectId}
        onOpenChange={() => setRenameProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
          </AlertDialogHeader>
          <div className='py-2'>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameProjectId(null)
              }}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!newProjectName}
        onOpenChange={() => setNewProjectName('')}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Project</AlertDialogTitle>
          </AlertDialogHeader>
          <div className='py-2'>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setNewProjectName('')
              }}
              placeholder='Project name'
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreate}
              disabled={isCreating || !newProjectName.trim()}
            >
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
