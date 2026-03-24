import * as React from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CellSelection, selectionCell } from '@tiptap/pm/tables'

import { Document } from '@tiptap/extension-document'
import { Text } from '@tiptap/extension-text'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Heading } from '@tiptap/extension-heading'
import { Blockquote } from '@tiptap/extension-blockquote'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Bold } from '@tiptap/extension-bold'
import { Italic } from '@tiptap/extension-italic'
import { Underline } from '@tiptap/extension-underline'
import { Strike } from '@tiptap/extension-strike'
import { Code } from '@tiptap/extension-code'
import { Highlight } from '@tiptap/extension-highlight'
import { Link } from '@tiptap/extension-link'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import {
  BulletList,
  OrderedList,
  ListItem,
  ListKeymap,
} from '@tiptap/extension-list'
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { UniqueID } from '@tiptap/extension-unique-id'
import { Markdown } from '@tiptap/markdown'
import {
  Placeholder,
  UndoRedo,
  Dropcursor,
  Gapcursor,
} from '@tiptap/extensions'
import { InvisibleCharacters } from '@tiptap/extension-invisible-characters'

import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Highlighter,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Table2,
  ChevronDown,
  Rows3,
  Columns3,
  Trash2,
  TableRowsSplit,
  TableColumnsSplit,
  Pilcrow,
  FileCode2,
  Copy,
  Check,
} from 'lucide-react'

import '@/styles/editor.css'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IEditorProps {
  /** Initial markdown content */
  content?: string
  /** Called on every content change with updated markdown */
  onChange?: (markdown: string) => void
  /** Makes editor read-only while AI is streaming */
  isStreaming?: boolean
  /** Placeholder text shown in empty document */
  placeholder?: string
  /** Called once the TipTap editor instance is ready — lets parent capture a ref */
  onEditorReady?: (editor: TiptapEditor) => void
  /** Called when the TipTap editor is destroyed */
  onEditorDestroy?: () => void
}

// ─── Table Affordances Extension ──────────────────────────────────────────────
// Injects "+ Row" and "+ Column" widget buttons after each table via ProseMirror
// decorations. Rebuilds only when the document structure changes.

const tableAffordancesKey = new PluginKey<DecorationSet>('tableAffordances')

function buildTableDecorations(doc: any, editor: TiptapEditor): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== 'table') return

    const makeWidget = () => {
      const wrap = document.createElement('div')
      wrap.className = 'editor-table-affordances'
      wrap.setAttribute('contenteditable', 'false')

      const mkBtn = (label: string, title: string, onClick: () => void) => {
        const btn = document.createElement('button')
        btn.className = 'editor-table-add-btn'
        btn.title = title
        btn.innerHTML =
          `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" ` +
          `stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
          `<path d="M5 12h14"/><path d="M12 5v14"/></svg>` +
          `<span>${label}</span>`
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        })
        return btn
      }

      wrap.appendChild(
        mkBtn('Row', 'Add row below', () => editor.commands.addRowAfter())
      )
      wrap.appendChild(
        mkBtn('Column', 'Add column after', () =>
          editor.commands.addColumnAfter()
        )
      )
      return wrap
    }

    decorations.push(
      Decoration.widget(pos + node.nodeSize, makeWidget, {
        side: 1,
        key: `table-add-${pos}`,
      })
    )
  })

  return DecorationSet.create(doc, decorations)
}

const TableAffordances = Extension.create({
  name: 'tableAffordances',

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ext = this

    return [
      new Plugin({
        key: tableAffordancesKey,
        state: {
          init(_, { doc }) {
            return buildTableDecorations(doc, ext.editor as TiptapEditor)
          },
          apply(tr, prev) {
            if (!tr.docChanged) return prev.map(tr.mapping, tr.doc)
            return buildTableDecorations(tr.doc, ext.editor as TiptapEditor)
          },
        },
        props: {
          decorations(state) {
            return tableAffordancesKey.getState(state)
          },
        },
      }),
    ]
  },
})

// ─── Module augmentation for custom table commands ────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableSelect: {
      selectTableRow: () => ReturnType
      selectTableColumn: () => ReturnType
    }
  }
}

// ─── Custom extension: row / column selection ─────────────────────────────────
const TableSelectExtension = Extension.create({
  name: 'tableSelect',
  addCommands() {
    return {
      selectTableRow:
        () =>
        ({ state, dispatch }) => {
          const $cell = selectionCell(state)
          if (!$cell) return false
          const sel = CellSelection.rowSelection($cell)
          if (dispatch) dispatch(state.tr.setSelection(sel))
          return true
        },
      selectTableColumn:
        () =>
        ({ state, dispatch }) => {
          const $cell = selectionCell(state)
          if (!$cell) return false
          const sel = CellSelection.colSelection($cell)
          if (dispatch) dispatch(state.tr.setSelection(sel))
          return true
        },
    }
  },
})

// ─── Link extension with Cmd+K shortcut ───────────────────────────────────────

const LinkWithShortcut = Link.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        this.editor.view.dom.dispatchEvent(
          new CustomEvent('editor:openLink', { bubbles: true })
        )
        return true
      },
    }
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Sep() {
  return <div className='h-4 w-px bg-border/70 mx-0.5 shrink-0' />
}

function TipBtn({
  label,
  isActive,
  disabled,
  onClick,
  children,
}: {
  label: string
  isActive?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Toggle
      size='sm'
      pressed={isActive}
      onPressedChange={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className='rounded-none'
    >
      {children}
    </Toggle>
  )
}

function getBlockLabel(editor: TiptapEditor): string {
  if (editor.isActive('heading', { level: 1 })) return 'Heading 1'
  if (editor.isActive('heading', { level: 2 })) return 'Heading 2'
  if (editor.isActive('heading', { level: 3 })) return 'Heading 3'
  if (editor.isActive('blockquote')) return 'Blockquote'
  if (editor.isActive('codeBlock')) return 'Code Block'
  return 'Paragraph'
}

// ─── Link Popover ─────────────────────────────────────────────────────────────

interface LinkPopoverProps {
  editor: TiptapEditor
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
}

function LinkPopover({
  editor,
  open,
  onOpenChange,
  disabled,
}: LinkPopoverProps) {
  const isActive = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive('link'),
  })

  const [url, setUrl] = useState('')

  // Sync URL from editor state when popover opens
  useEffect(() => {
    if (open) {
      const href = editor.getAttributes('link').href ?? ''
      setUrl(href)
    }
  }, [open, editor])

  const apply = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      editor.chain().focus().unsetLink().run()
    } else {
      const href = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
      editor.chain().focus().setLink({ href }).run()
    }
    onOpenChange(false)
  }

  const remove = () => {
    editor.chain().focus().unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Toggle
            size='sm'
            pressed={isActive}
            disabled={disabled}
            aria-label='Link (⌘K)'
            title='Link (⌘K)'
            className='rounded-none'
          >
            <Link2 className='h-3.5 w-3.5' />
          </Toggle>
        }
      />
      <PopoverContent
        side='bottom'
        align='start'
        sideOffset={6}
        className='w-72 p-2 flex flex-col gap-2'
      >
        <div className='flex gap-1.5'>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='https://…'
            className='h-7 text-xs rounded-none flex-1'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onOpenChange(false)
              }
            }}
            autoFocus
          />
          <Button
            size='sm'
            variant='outline'
            onClick={apply}
            className='h-7 px-2 text-xs rounded-none'
          >
            Apply
          </Button>
        </div>
        {isActive && (
          <Button
            size='sm'
            variant='ghost'
            onClick={remove}
            className='h-7 text-xs justify-start text-muted-foreground hover:text-destructive rounded-none'
          >
            Remove link
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ─── Table Context Bar ────────────────────────────────────────────────────────

function TableContextBar({
  editor,
  disabled,
}: {
  editor: TiptapEditor
  disabled?: boolean
}) {
  return (
    <>
      <Sep />
      <div className='flex items-center gap-0.5'>
        <TipBtn
          label='Select row'
          disabled={disabled}
          onClick={() => editor.commands.selectTableRow()}
        >
          <TableRowsSplit className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Select column'
          disabled={disabled}
          onClick={() => editor.commands.selectTableColumn()}
        >
          <TableColumnsSplit className='h-3.5 w-3.5' />
        </TipBtn>
        <Sep />
        <TipBtn
          label='Add row'
          disabled={disabled}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <Rows3 className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Add column'
          disabled={disabled}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns3 className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Delete row'
          disabled={disabled}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          <span className='text-[10px] font-medium leading-none'>−R</span>
        </TipBtn>
        <TipBtn
          label='Delete column'
          disabled={disabled}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          <span className='text-[10px] font-medium leading-none'>−C</span>
        </TipBtn>
        <Sep />
        <Toggle
          size='sm'
          pressed={false}
          onPressedChange={() => editor.chain().focus().deleteTable().run()}
          disabled={disabled}
          aria-label='Delete table'
          title='Delete table'
          className='rounded-none text-muted-foreground hover:text-destructive'
        >
          <Trash2 className='h-3.5 w-3.5' />
        </Toggle>
      </div>
    </>
  )
}

// ─── Markdown Source Dialog ───────────────────────────────────────────────────
// Uses createPortal + plain divs to avoid Base UI's @starting-style animation
// issue in the Tauri WebView where opacity stays at 0 permanently.

function MarkdownDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: TiptapEditor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState(false)
  const markdown = open
    ? ((editor as unknown as { getMarkdown?: () => string }).getMarkdown?.() ?? '')
    : ''

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  const copy = () => {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 z-50 bg-black/20 backdrop-blur-sm'
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className='fixed inset-[5%] z-50 flex flex-col bg-background ring-1 ring-foreground/10 overflow-hidden rounded-none'>
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-3 border-b shrink-0'>
          <div>
            <div className='text-sm font-medium'>Markdown source</div>
            <div className='text-xs text-muted-foreground mt-0.5'>
              Read-only
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={copy}
              className='gap-1.5 rounded-none h-7 text-xs'
            >
              {copied ? (
                <Check className='h-3.5 w-3.5' />
              ) : (
                <Copy className='h-3.5 w-3.5' />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => onOpenChange(false)}
              className='rounded-none h-7 text-xs'
            >
              Close
            </Button>
          </div>
        </div>
        {/* Content */}
        <ScrollArea className='flex-1 min-h-0'>
          <pre className='p-5 font-mono text-xs text-foreground/80 whitespace-pre-wrap wrap-break-word leading-relaxed'>
            {markdown || (
              <span className='text-muted-foreground italic'>
                Empty document
              </span>
            )}
          </pre>
        </ScrollArea>
      </div>
    </>,
    document.body
  )
}

// ─── Editor Toolbar ───────────────────────────────────────────────────────────

interface ToolbarInnerProps {
  editor: TiptapEditor
  isStreaming: boolean
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}

function EditorToolbarInner({
  editor,
  isStreaming,
  linkOpen,
  onLinkOpenChange,
}: ToolbarInnerProps) {
  const disabled = isStreaming
  const [markdownOpen, setMarkdownOpen] = useState(false)

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e.isActive('bold'),
      isItalic: e.isActive('italic'),
      isUnderline: e.isActive('underline'),
      isStrike: e.isActive('strike'),
      isCode: e.isActive('code'),
      isHighlight: e.isActive('highlight'),
      isAlignLeft: e.isActive({ textAlign: 'left' }),
      isAlignCenter: e.isActive({ textAlign: 'center' }),
      isAlignRight: e.isActive({ textAlign: 'right' }),
      isBullet: e.isActive('bulletList'),
      isOrdered: e.isActive('orderedList'),
      isInTable: e.isActive('table'),
      blockLabel: getBlockLabel(e),
      isInvisible:
        ((e.storage as unknown as Record<string, unknown>).invisibleCharacters as { visibility?: () => boolean } | undefined)?.visibility?.() ?? false,
    }),
  })

  // Open link popover via keyboard shortcut
  useEffect(() => {
    const handler = () => onLinkOpenChange(true)
    editor.view.dom.addEventListener('editor:openLink', handler)
    return () => editor.view.dom.removeEventListener('editor:openLink', handler)
  }, [editor, onLinkOpenChange])

  return (
    <div className='flex items-center gap-0.5 px-2 flex-wrap'>
      {/* Block format */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className={cn(
            'flex items-center gap-1 h-7 px-2 rounded-none text-xs font-medium',
            'hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none',
            'text-foreground/80 min-w-24.5 justify-between'
          )}
        >
          <span>{s.blockLabel}</span>
          <ChevronDown className='h-3 w-3 opacity-50' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='min-w-36'>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().setParagraph().run()}
          >
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            Heading 3
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
          >
            Blockquote
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            Code Block
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sep />

      {/* Inline formatting */}
      <div className='flex items-center gap-0.5'>
        <TipBtn
          label='Bold (⌘B)'
          isActive={s.isBold}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Italic (⌘I)'
          isActive={s.isItalic}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Underline (⌘U)'
          isActive={s.isUnderline}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Strikethrough'
          isActive={s.isStrike}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Inline code'
          isActive={s.isCode}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Highlight'
          isActive={s.isHighlight}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className='h-3.5 w-3.5' />
        </TipBtn>
      </div>

      <Sep />

      {/* Text alignment */}
      <div className='flex items-center gap-0.5'>
        <TipBtn
          label='Align left'
          isActive={s.isAlignLeft}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Align center'
          isActive={s.isAlignCenter}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Align right'
          isActive={s.isAlignRight}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className='h-3.5 w-3.5' />
        </TipBtn>
      </div>

      <Sep />

      {/* Lists */}
      <div className='flex items-center gap-0.5'>
        <TipBtn
          label='Bullet list'
          isActive={s.isBullet}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className='h-3.5 w-3.5' />
        </TipBtn>
        <TipBtn
          label='Ordered list'
          isActive={s.isOrdered}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className='h-3.5 w-3.5' />
        </TipBtn>
      </div>

      <Sep />

      {/* Link */}
      <LinkPopover
        editor={editor}
        open={linkOpen}
        onOpenChange={onLinkOpenChange}
        disabled={disabled}
      />

      {/* Insert table */}
      <Toggle
        size='sm'
        pressed={false}
        onPressedChange={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        disabled={disabled}
        aria-label='Insert table'
        title='Insert table'
        className='rounded-none'
      >
        <Table2 className='h-3.5 w-3.5' />
      </Toggle>

      {/* Contextual table controls */}
      {s.isInTable && <TableContextBar editor={editor} disabled={disabled} />}

      <div className='ml-auto flex items-center gap-0.5 pr-1'>
        <Sep />

        {/* Invisible characters */}
        <TipBtn
          label='Show invisible characters'
          isActive={s.isInvisible}
          disabled={disabled}
          onClick={() => editor.commands.toggleInvisibleCharacters()}
        >
          <Pilcrow className='h-3.5 w-3.5' />
        </TipBtn>

        {/* Markdown source */}
        <Toggle
          size='sm'
          pressed={false}
          onPressedChange={() => setMarkdownOpen(true)}
          aria-label='View markdown source'
          title='View markdown source'
          className='rounded-none'
        >
          <FileCode2 className='h-3.5 w-3.5' />
        </Toggle>
      </div>

      <MarkdownDialog
        editor={editor}
        open={markdownOpen}
        onOpenChange={setMarkdownOpen}
      />
    </div>
  )
}

function EditorToolbar({
  editor,
  isStreaming,
  linkOpen,
  onLinkOpenChange,
}: {
  editor: TiptapEditor | null
  isStreaming: boolean
  linkOpen: boolean
  onLinkOpenChange: (open: boolean) => void
}) {
  if (!editor) {
    return <div className='h-9 border-b bg-background/80 shrink-0' />
  }

  return (
    <div
      className={cn(
        'flex items-center min-h-9 border-b bg-background/80 shrink-0 overflow-x-auto',
        isStreaming && 'opacity-50 pointer-events-none'
      )}
    >
      <EditorToolbarInner
        editor={editor}
        isStreaming={isStreaming}
        linkOpen={linkOpen}
        onLinkOpenChange={onLinkOpenChange}
      />
    </div>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function Editor({
  content,
  onChange,
  isStreaming = false,
  placeholder = 'Start writing…',
  onEditorReady,
  onEditorDestroy,
}: IEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      Document,
      Text,
      Paragraph,
      Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      Blockquote,
      CodeBlock,
      Bold,
      Italic,
      Underline,
      Strike,
      Code,
      Highlight.configure({ multicolor: false }),
      LinkWithShortcut.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Subscript,
      Superscript,
      BulletList,
      OrderedList,
      ListItem,
      ListKeymap,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TableAffordances,
      TableSelectExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Typography,
      UniqueID.configure({
        types: ['heading', 'paragraph', 'blockquote', 'codeBlock'],
      }),
      Markdown,
      Placeholder.configure({ placeholder }),
      UndoRedo,
      Dropcursor,
      Gapcursor,
      InvisibleCharacters,
    ],
    content: content ?? '',
    editable: !isStreaming,
    immediatelyRender: false,
    onCreate({ editor: e }) {
      onEditorReady?.(e)
    },
    onDestroy() {
      onEditorDestroy?.()
    },
    onUpdate({ editor: e }) {
      onChange?.((e as TiptapEditor & { getMarkdown: () => string }).getMarkdown())
    },
  })

  // Sync editable state when isStreaming changes
  useEffect(() => {
    editor?.setEditable(!isStreaming)
  }, [editor, isStreaming])

  // Paste-to-link: if text is selected and clipboard contains a URL, attach it as a link
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')?.trim() ?? ''
      if (!editor.state.selection.empty && /^https?:\/\//.test(text)) {
        e.preventDefault()
        editor.chain().focus().setLink({ href: text }).run()
      }
    }
    dom.addEventListener('paste', handlePaste)
    return () => dom.removeEventListener('paste', handlePaste)
  }, [editor])

  return (
    <TooltipProvider>
      <div className='flex flex-col h-full min-h-0'>
        <EditorToolbar
          editor={editor}
          isStreaming={isStreaming}
          linkOpen={linkOpen}
          onLinkOpenChange={setLinkOpen}
        />
        <ScrollArea className='flex-1 min-h-0'>
          <div className='px-8 py-10'>
            <EditorContent
              editor={editor}
              className='min-h-50 focus-within:outline-none'
            />
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  )
}
