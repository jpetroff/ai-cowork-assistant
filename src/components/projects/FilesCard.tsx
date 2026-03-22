import { UploadSimpleIcon } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function FilesCard() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadSimpleIcon className="size-3.5 text-muted-foreground" />
          Files
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            Coming soon
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* TODO: implement file upload when backend is ready */}
        <Button variant="outline" size="sm" className="w-full" disabled>
          <UploadSimpleIcon className="size-3.5" />
          Upload file
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          No files uploaded yet
        </p>
      </CardContent>
    </Card>
  )
}
