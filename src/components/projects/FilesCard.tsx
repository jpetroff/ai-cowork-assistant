import { UploadSimpleIcon } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function FilesCard() {
  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <UploadSimpleIcon className='size-icon-sm text-muted-foreground' />
          Files
          <Badge variant='secondary' className='ml-auto font-normal'>
            Coming soon
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        {/* TODO: implement file upload when backend is ready */}
        <Button variant='outline' size='sm' className='w-full' disabled>
          <UploadSimpleIcon className='size-icon-sm' />
          Upload file
        </Button>
        <p className='type-ui-sm text-muted-foreground text-center'>
          No files uploaded yet
        </p>
      </CardContent>
    </Card>
  )
}
