'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import '@/styles/editor.css'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Heading from '@tiptap/extension-heading'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Underline from '@tiptap/extension-underline'
import Code from '@tiptap/extension-code'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Emoji from '@tiptap/extension-emoji'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from '@tiptap/extension-table'
import InvisibleCharacters from '@tiptap/extension-invisible-characters'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import UniqueId from '@tiptap/extension-unique-id'
import { Markdown } from '@tiptap/markdown'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  Underline as UnderlineIcon,
  Code as CodeIcon,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Plus,
  Minus,
  Columns,
  Rows,
  Merge,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const extensions = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  Bold,
  Italic,
  Strike,
  Underline,
  Code,
  Highlight,
  Subscript,
  Superscript,
  TextStyle,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { target: '_blank', rel: 'noopener' },
  }),
  Emoji,
  BulletList,
  OrderedList,
  ListItem,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  InvisibleCharacters,
  Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  UniqueId.configure({ types: ['heading', 'paragraph'] }),
  Markdown.configure(),
]

export type ProjectEditorProps = {
  value: string
  onChange: (value: string) => void
  isStreaming: boolean
  className?: string
}

export function ProjectEditor({
  value,
  onChange,
  isStreaming,
  className,
}: ProjectEditorProps) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const isInitializedRef = useRef(false)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions,
    content: value || '',
    editable: !isStreaming,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[200px] px-3 py-2 focus:outline-none ProseMirror',
      },
    },
    onUpdate: ({ editor }) => {
      if (isStreaming) return
      const ed = editor as unknown as { getMarkdown?: () => string }
      const markdown =
        typeof ed.getMarkdown === 'function'
          ? ed.getMarkdown()
          : editor.getHTML()
      if (typeof markdown === 'string' && markdown !== valueRef.current) {
        valueRef.current = markdown
        onChangeRef.current(markdown)
      }
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!isStreaming)
  }, [editor, isStreaming])

  useEffect(() => {
    if (!editor) return
    // Initialize the ref on first load
    if (!isInitializedRef.current) {
      valueRef.current = value
      isInitializedRef.current = true
      return
    }
    // Skip if value hasn't changed
    if (value === valueRef.current) return
    valueRef.current = value
    try {
      editor.commands.setContent(value || '', {
        contentType: 'markdown',
        emitUpdate: false,
      })
    } catch {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 text-muted-foreground text-sm',
          className
        )}
      >
        Loading editor…
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col border-border rounded-md border bg-background',
        className
      )}
    >
      <div className='flex items-center gap-0.5 border-b border-border px-1 py-1 flex-wrap'>
        <Toggle
          size='sm'
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label='Bold'
        >
          <BoldIcon className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label='Italic'
        >
          <ItalicIcon className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          aria-label='Strikethrough'
        >
          <Strikethrough className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label='Underline'
        >
          <UnderlineIcon className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('code')}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
          aria-label='Code'
        >
          <CodeIcon className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('highlight')}
          onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
          aria-label='Highlight'
        >
          <Highlighter className='size-4' />
        </Toggle>
        <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
        <Toggle
          size='sm'
          pressed={editor.isActive('bulletList')}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          aria-label='Bullet list'
        >
          <List className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive('orderedList')}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          aria-label='Ordered list'
        >
          <ListOrdered className='size-4' />
        </Toggle>
        <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
        <Toggle
          size='sm'
          pressed={editor.isActive({ textAlign: 'left' })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign('left').run()
          }
          aria-label='Align left'
        >
          <AlignLeft className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive({ textAlign: 'center' })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign('center').run()
          }
          aria-label='Align center'
        >
          <AlignCenter className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive({ textAlign: 'right' })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign('right').run()
          }
          aria-label='Align right'
        >
          <AlignRight className='size-4' />
        </Toggle>
        <Toggle
          size='sm'
          pressed={editor.isActive({ textAlign: 'justify' })}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign('justify').run()
          }
          aria-label='Justify'
        >
          <AlignJustify className='size-4' />
        </Toggle>
        <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
        {editor.isActive('table') && (
          <>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              aria-label='Add column before'
              variant='ghost'
            >
              <Plus className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              aria-label='Add column after'
              variant='ghost'
            >
              <Columns className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().deleteColumn().run()}
              aria-label='Delete column'
              variant='ghost'
            >
              <Minus className='size-4' />
            </Button>
            <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().addRowBefore().run()}
              aria-label='Add row before'
              variant='ghost'
            >
              <Plus className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().addRowAfter().run()}
              aria-label='Add row after'
              variant='ghost'
            >
              <Rows className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().deleteRow().run()}
              aria-label='Delete row'
              variant='ghost'
            >
              <Minus className='size-4' />
            </Button>
            <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().mergeCells().run()}
              aria-label='Merge cells'
              variant='ghost'
            >
              <Merge className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon-sm'
              onClick={() => editor.chain().focus().splitCell().run()}
              aria-label='Split cell'
              variant='ghost'
            >
              <Columns className='size-4' />
            </Button>
            <span className='w-px h-5 bg-border mx-0.5' aria-hidden />
          </>
        )}
        <Button
          type='button'
          size='icon-sm'
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          aria-label='Insert table'
          variant='ghost'
        >
          <TableIcon className='size-4' />
        </Button>
      </div>
      {isStreaming && (
        <div className='px-3 py-1.5 text-muted-foreground text-xs border-b border-border bg-muted/30'>
          Assistant is writing…
        </div>
      )}
      <ScrollArea className='flex-1 max-h-[calc(100vh-12rem)]'>
        <EditorContent editor={editor} />
      </ScrollArea>
    </div>
  )
}
