'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface FileItem {
  name: string
  path: string
  kind: 'file'
  handle: FileSystemFileHandle
}

interface WikiNode {
  id: string
  title: string
  type: string
  content: string
  links: string[]
  handle: FileSystemFileHandle
  path: string
}
type TabType = 'vault' | 'editor' | 'chat' | 'graph'

interface LocalImageProps {
  src: string
  alt: string
  dirHandle: FileSystemDirectoryHandle | null
  className?: string
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

function LocalImage({ src, alt, dirHandle, className, onError }: LocalImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<boolean>(false)

  useEffect(() => {
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:')
    ) {
      setResolvedSrc(src)
      setLoadError(false)
      return
    }

    if (!dirHandle) {
      setLoadError(true)
      return
    }

    let active = true
    setLoading(true)
    setLoadError(false)

    const fetchLocalImage = async () => {
      try {
        const cleanPath = src.startsWith('/') ? src.slice(1) : src
        const parts = cleanPath.split('/').filter(Boolean)
        let currentHandle = dirHandle
        
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i])
        }
        
        const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1])
        const file = await fileHandle.getFile()
        const objectUrl = URL.createObjectURL(file)
        
        if (active) {
          setResolvedSrc(objectUrl)
          setLoading(false)
        }
      } catch (err) {
        console.error('Error resolving local image path:', src, err)
        if (active) {
          setLoadError(true)
          setLoading(false)
        }
      }
    }

    fetchLocalImage()

    return () => {
      active = false
      if (resolvedSrc && resolvedSrc.startsWith('blob:')) {
        URL.revokeObjectURL(resolvedSrc)
      }
    }
  }, [src, dirHandle])

  if (loadError) {
    return (
      <div className="text-xs text-center py-4 text-stone-500 border border-dashed border-stone-850 rounded-xl bg-stone-900/10">
        🖼️ Image could not load: {alt || src}
      </div>
    )
  }

  if (loading || !resolvedSrc) {
    return (
      <div className="text-xs text-center py-4 text-stone-500 border border-dashed border-stone-850 rounded-xl animate-pulse">
        ⏳ Loading local image...
      </div>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={(e) => {
        setLoadError(true)
        if (onError) onError(e)
      }}
    />
  )
}

interface VaultStatusData {
  lastCompileTime: number
  rawFilesCount: number
  pending: string[]
  upToDate: string[]
}

const COMMAND_HELP_DETAILS: Record<string, { desc: string; usage: string; example: string }> = {
  '#compile': {
    desc: 'Analyzes new and modified raw source files in your raw folder, discusses them with Ember, extracts core concepts, and incrementally compiles/merges them into your concept wiki. You can append custom instructions to guide the compilation focus.',
    usage: '#compile [optional compilation instructions]',
    example: '#compile Focus on analyzing the main characters and key symbols'
  },
  '#compile-force': {
    desc: 'Forces compilation of all raw sources in the raw folder, completely overwriting/updating the existing wiki pages based on all source text. Useful if you updated your compile rules or want a full rebuild.',
    usage: '#compile-force [optional compilation instructions]',
    example: '#compile-force'
  },
  '#reindex': {
    desc: 'Scans the wiki folder and regenerates index.md (Table of Contents grouped by concept types like Works, Themes, Characters, Devices, etc.) and log.md files, ensuring all concepts are properly referenced and structured.',
    usage: '#reindex',
    example: '#reindex'
  },
  '#status': {
    desc: 'Checks the vault directory and lists raw files that have been added or updated since the last compile time, giving you a preview of pending changes.',
    usage: '#status',
    example: '#status'
  },
  '#lint': {
    desc: 'Audits your wiki pages against the Karpathy LLM Wiki format standards: checks for proper frontmatter metadata, existence of summary/sources sections, broken concept wiki-links, and identifies orphan pages (pages with no incoming links).',
    usage: '#lint',
    example: '#lint'
  },
  '#create': {
    desc: 'Creates a new blank file in the vault at the specified relative path. If the path contains subdirectories that do not exist, they will be created automatically. MD files are initialized with metadata headers.',
    usage: '#create [relative-path]',
    example: '#create raw/new-notes.md'
  },
  '#delete': {
    desc: 'Deletes a file from the vault folder by its relative path. System critical files like index.md, log.md, and .garden-config.json cannot be deleted.',
    usage: '#delete [relative-path]',
    example: '#delete wiki/old-notes.md'
  },
  '#rename': {
    desc: 'Renames a file in your vault from its old path to a new path, maintaining the folder structure. Automatically updates references.',
    usage: '#rename [old-relative-path] [new-relative-path]',
    example: '#rename raw/old-name.md raw/new-name.md'
  },
  '#search': {
    desc: 'Performs a case-insensitive search across all text files in the vault to find files containing the specified query term, listing match counts and locations.',
    usage: '#search [query-term]',
    example: '#search character development'
  },
  '#log': {
    desc: 'Appends a custom manual log entry to the append-only wiki/log.md file to document actions or record thoughts.',
    usage: '#log [log-message]',
    example: '#log Added raw/notes.md after class discussion'
  },
  '#config': {
    desc: 'Displays the current active vault settings, including the subject/domain, the raw folder name, and the wiki folder name.',
    usage: '#config',
    example: '#config'
  },
  '#help': {
    desc: 'Displays the command reference helper list in the agent console logs.',
    usage: '#help',
    example: '#help'
  }
}

export default function MindSailingMVP() {
  // Directory & Files State
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [folderName, setFolderName] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  
  // Custom Vault Config State
  const [gardenSubject, setGardenSubject] = useState<string>('Mind Sailing')
  const [rawFolderName, setRawFolderName] = useState<string>('raw')
  const [wikiFolderName, setWikiFolderName] = useState<string>('wiki')
  const [subdirs, setSubdirs] = useState<string[]>([])
  
  // Layout and Help States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [selectedHelpCommand, setSelectedHelpCommand] = useState<string | null>(null)
  const [resolvedActions, setResolvedActions] = useState<Record<number, 'approved' | 'dismissed'>>({})
  const [vaultTransitionPending, setVaultTransitionPending] = useState<'open' | 'init' | null>(null)

  // Active State
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [editorText, setEditorText] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [showNewRawMenu, setShowNewRawMenu] = useState(false)
  const [editorMode, setEditorMode] = useState<'edit' | 'visual'>('visual')

  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai' | 'system'; text: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  // Inline annotation system
  const [pendingComments, setPendingComments] = useState<Array<{ quote: string; note: string }>>([])
  const [commentPopover, setCommentPopover] = useState<{ quote: string } | null>(null)
  const [commentDraft, setCommentDraft] = useState('')

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [proposalComments, setProposalComments] = useState<Record<number, string>>({})

  // Compiler State
  const [isCompiling, setIsCompiling] = useState(false)
  const [graphStatus, setGraphStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const [graphError, setGraphError] = useState('')
  const [graphRetry, setGraphRetry] = useState(0)
  const [showGraphSettings, setShowGraphSettings] = useState(false)
  const [graphTypeMap, setGraphTypeMap] = useState<Record<string, string>>({})
  const [graphSettings, setGraphSettings] = useState({
    nodeSize: 14,
    edgeWidth: 1.5,
    showArrows: true,
    repulsion: -9000,
    centralGravity: 0.06,
    springLength: 240,
  })
  const graphSettingsRef = useRef(graphSettings)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const hiddenTypesRef = useRef<Set<string>>(new Set())
  const graphAllNodesRef = useRef<any[]>([])
  const graphAllEdgesRef = useRef<any[]>([])
  const graphNodeTypeRef = useRef<Record<string, string>>({})
  const [compileLog, setCompileLog] = useState<string[]>([])

  // Autocomplete Suggestions State
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)

  const [consoleLogsVal, setConsoleLogsVal] = useState<string[]>([
    'Ember Socratic Chat Console ready.',
    'Ask Ember to compile, reindex, or check status in natural language or using commands.',
    'Type # to see available commands.'
  ])
  const consoleLogs = consoleLogsVal
  const isChatCommandActiveRef = useRef(false)
  const consoleLogsRef = useRef<string[]>([
    'Ember Socratic Chat Console ready.',
    'Ask Ember to compile, reindex, or check status in natural language or using commands.',
    'Type # to see available commands.'
  ])

  const setConsoleLogs = useCallback((valOrFunc: string[] | ((prev: string[]) => string[])) => {
    let next: string[]
    if (typeof valOrFunc === 'function') {
      next = valOrFunc(consoleLogsRef.current)
    } else {
      next = valOrFunc
    }
    const added = next.slice(consoleLogsRef.current.length)
    consoleLogsRef.current = next
    setConsoleLogsVal(next)

    if (added.length > 0 && isChatCommandActiveRef.current) {
      setChatMessages(chatPrev => [
        ...chatPrev,
        ...added.map(line => ({ role: 'system' as const, text: line }))
      ])
    }
  }, [])

  const consoleEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleLogs])

  // Keep graphSettingsRef in sync so the graph effect always reads fresh values
  useEffect(() => { graphSettingsRef.current = graphSettings }, [graphSettings])

  // Keep hiddenTypesRef in sync (avoids stale closure inside runGraph)
  useEffect(() => { hiddenTypesRef.current = hiddenTypes }, [hiddenTypes])

  // Push type-filter changes into the live vis-network instance without full re-render
  useEffect(() => {
    if (!networkInstance.current || !graphAllNodesRef.current.length) return
    const visible = graphAllNodesRef.current.filter(n => {
      const t = graphNodeTypeRef.current[n.id]
      return !t || !hiddenTypes.has(t)   // ghost nodes (no type entry) always shown
    })
    const visibleIds = new Set(visible.map((n: any) => n.id))
    const visEdges = graphAllEdgesRef.current.filter((e: any) =>
      visibleIds.has(e.from) && visibleIds.has(e.to)
    )
    networkInstance.current.setData({ nodes: visible, edges: visEdges })
    networkInstance.current.once('stabilizationIterationsDone', () => {
      networkInstance.current?.fit({ animation: false })
    })
  }, [hiddenTypes])

  // Push live setting changes into the running vis-network instance
  useEffect(() => {
    if (!networkInstance.current) return
    networkInstance.current.setOptions({
      nodes: { size: graphSettings.nodeSize },
      edges: {
        width: graphSettings.edgeWidth,
        arrows: { to: { enabled: graphSettings.showArrows, scaleFactor: 0.5 } },
      },
      physics: {
        barnesHut: {
          gravitationalConstant: graphSettings.repulsion,
          centralGravity: graphSettings.centralGravity,
          springLength: graphSettings.springLength,
        },
      },
    })
  }, [graphSettings])

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches
        if (isDesktop && !isSidebarCollapsed && activeTab === 'vault') {
          setActiveTab('chat')
        }
      }
      window.addEventListener('resize', handleResize)
      handleResize() // check initially
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isSidebarCollapsed, activeTab])

  const getHashtagMatch = (input: string) => {
    const match = input.match(/(#[a-zA-Z0-9-]*)$/)
    return match ? match[1] : null
  }

  const hashtagMatch = getHashtagMatch(chatInput)
  const suggestions = hashtagMatch
    ? ['#compile', '#compile-force', '#reindex', '#status', '#lint', '#delete', '#create', '#rename', '#search', '#log', '#config', '#help'].filter(s =>
        s.toLowerCase().startsWith(hashtagMatch.toLowerCase())
      )
    : []

  const selectSuggestion = (selected: string) => {
    if (!hashtagMatch) return
    const lastIndex = chatInput.lastIndexOf(hashtagMatch)
    const newInput = chatInput.slice(0, lastIndex) + selected + ' '
    setChatInput(newInput)
    setShowSuggestions(false)
    setActiveSuggestionIdx(0)
  }

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setChatInput(val)
    const match = getHashtagMatch(val)
    if (match) {
      setShowSuggestions(true)
      setActiveSuggestionIdx(0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestionIdx(prev => (prev + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        selectSuggestion(suggestions[activeSuggestionIdx])
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (chatInput.trim()) {
        sendChatMessage()
      }
    }
  }

  // Graph Ref
  const graphRef = useRef<HTMLDivElement>(null)
  const networkInstance = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSavedText = useRef<string>('')

  // Save helper for .garden-config.json
  async function saveGardenConfig(subject: string, raw: string, wiki: string, handleToUse = dirHandle) {
    const activeHandle = handleToUse || dirHandle
    if (!activeHandle) return
    try {
      const configHandle = await activeHandle.getFileHandle('.garden-config.json', { create: true })
      const writable = await configHandle.createWritable()
      await writable.write(JSON.stringify({
        subject,
        rawFolder: raw,
        wikiFolder: wiki
      }, null, 2))
      await writable.close()
    } catch (err) {
      console.error('Error saving .garden-config.json:', err)
    }
  }

  // 1. Open local folder
  // 1. Open local folder
  async function executeSelectFolder() {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      setDirHandle(handle)
      setFolderName(handle.name)

      let activeSubject = 'Mind Sailing'
      let activeRaw = 'raw'
      let activeWiki = 'wiki'

      try {
        const configHandle = await handle.getFileHandle('.garden-config.json')
        const configFile = await configHandle.getFile()
        const text = await configFile.text()
        const config = JSON.parse(text)
        if (config.subject === 'English A') {
          activeSubject = 'Mind Sailing'
          if (config.rawFolder) activeRaw = config.rawFolder
          if (config.wikiFolder) activeWiki = config.wikiFolder
          await saveGardenConfig(activeSubject, activeRaw, activeWiki, handle)
        } else {
          if (config.subject) activeSubject = config.subject
          if (config.rawFolder) activeRaw = config.rawFolder
          if (config.wikiFolder) activeWiki = config.wikiFolder
        }
        
        setGardenSubject(activeSubject)
        setRawFolderName(activeRaw)
        setWikiFolderName(activeWiki)
      } catch (err) {
        setGardenSubject(activeSubject)
        setRawFolderName(activeRaw)
        setWikiFolderName(activeWiki)
        await saveGardenConfig(activeSubject, activeRaw, activeWiki, handle)
      }

      await loadFiles(handle, activeRaw, activeWiki)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Error selecting folder: ' + err.message)
      }
    }
  }

  async function selectFolder() {
    if (chatMessages.length > 0) {
      setVaultTransitionPending('open')
    } else {
      await executeSelectFolder()
    }
  }

  // 2. Initialize a blank Obsidian-compatible vault
  async function executeInitNewVault() {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      
      let loadedSubject = 'Mind Sailing'
      let loadedRaw = 'raw'
      let loadedWiki = 'wiki'

      try {
        const configHandle = await handle.getFileHandle('.garden-config.json')
        const configFile = await configHandle.getFile()
        const text = await configFile.text()
        const config = JSON.parse(text)
        if (config.subject === 'English A') {
          loadedSubject = 'Mind Sailing'
          if (config.rawFolder) loadedRaw = config.rawFolder
          if (config.wikiFolder) loadedWiki = config.wikiFolder
          await saveGardenConfig(loadedSubject, loadedRaw, loadedWiki, handle)
        } else {
          if (config.subject) loadedSubject = config.subject
          if (config.rawFolder) loadedRaw = config.rawFolder
          if (config.wikiFolder) loadedWiki = config.wikiFolder
        }

        setGardenSubject(loadedSubject)
        setRawFolderName(loadedRaw)
        setWikiFolderName(loadedWiki)
      } catch (e) {
        setGardenSubject(loadedSubject)
        setRawFolderName(loadedRaw)
        setWikiFolderName(loadedWiki)
        await saveGardenConfig(loadedSubject, loadedRaw, loadedWiki, handle)
      }

      // Create subdirectories using hydrated or default folder names
      await handle.getDirectoryHandle(loadedRaw, { create: true })
      const wikiHandle = await handle.getDirectoryHandle(loadedWiki, { create: true })
      const obsidianHandle = await handle.getDirectoryHandle('.obsidian', { create: true })

      // Create wiki/index.md using hydrated or default subject
      const indexFile = await wikiHandle.getFileHandle('index.md', { create: true })
      const indexWritable = await indexFile.createWritable()
      await indexWritable.write(`# Index\n\nWelcome to your ${loadedSubject}!\n`)
      await indexWritable.close()

      // Create wiki/log.md
      const logFile = await wikiHandle.getFileHandle('log.md', { create: true })
      const logWritable = await logFile.createWritable()
      await logWritable.write(`# Compilation Log\n\n- Vault initialized on ${new Date().toISOString()}\n`)
      await logWritable.close()

      // Create .obsidian/graph.json with custom colors
      const graphPresetFile = await obsidianHandle.getFileHandle('graph.json', { create: true })
      const graphPresetWritable = await graphPresetFile.createWritable()
      await graphPresetWritable.write(JSON.stringify({
        "collapse-filter": false,
        "search": "",
        "showTags": false,
        "showAttachments": false,
        "hideUnresolved": false,
        "showOrphans": true,
        "collapse-color-groups": false,
        "colorGroups": [
          { "query": "path:wiki/works", "color": { "a": 1, "rgb": 15433618 } },
          { "query": "path:wiki/characters", "color": { "a": 1, "rgb": 3241071 } },
          { "query": "path:wiki/themes", "color": { "a": 1, "rgb": 16171383 } },
          { "query": "path:wiki/devices", "color": { "a": 1, "rgb": 10276824 } },
          { "query": "path:wiki/global-issues", "color": { "a": 1, "rgb": 12888039 } }
        ],
        "collapse-display": false,
        "showArrow": true,
        "textFadeMultiplier": 0,
        "nodeSizeMultiplier": 1,
        "lineThicknessMultiplier": 1,
        "forceStrength": 1,
        "linkDistance": 100,
        "linkStrength": 1,
        "repelStrength": 10
      }, null, 2))
      await graphPresetWritable.close()

      setDirHandle(handle)
      setFolderName(handle.name)
      await loadFiles(handle, loadedRaw, loadedWiki)
      alert('Vault initialized successfully on your local disk!')
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Initialization failed: ' + err.message)
      }
    }
  }

  async function initNewVault() {
    if (chatMessages.length > 0) {
      setVaultTransitionPending('init')
    } else {
      await executeInitNewVault()
    }
  }

  // 2a. Vault Transition Handlers
  async function handleTransitionKeep() {
    const type = vaultTransitionPending
    setVaultTransitionPending(null)
    if (type === 'open') {
      await executeSelectFolder()
    } else if (type === 'init') {
      await executeInitNewVault()
    }
  }

  async function handleTransitionWipe() {
    const type = vaultTransitionPending
    setVaultTransitionPending(null)
    setChatMessages([])
    if (type === 'open') {
      await executeSelectFolder()
    } else if (type === 'init') {
      await executeInitNewVault()
    }
  }

  async function handleTransitionArchiveWipe() {
    const type = vaultTransitionPending
    setVaultTransitionPending(null)

    if (dirHandle && chatMessages.length > 0) {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        
        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`
        const fileDateStr = `${year}${month}${day}-${hours}${minutes}`
        
        const markdownContent = `---
title: "Chat Log: ${formattedDate}"
date: "${year}-${month}-${day}"
type: "chat-log"
---

# Chat Log: ${formattedDate}

${chatMessages.map(m => `### ${m.role === 'user' ? 'User' : 'Ember (AI)'}\n${m.text}`).join('\n\n')}
`
        let rawHandle = dirHandle
        if (rawFolderName && rawFolderName !== '.') {
          const parts = rawFolderName.split('/')
          for (const part of parts) {
            if (part.trim()) {
              rawHandle = await rawHandle.getDirectoryHandle(part, { create: true })
            }
          }
        }
        const chatsHandle = await rawHandle.getDirectoryHandle('chats', { create: true })
        const filename = `chat-log-${fileDateStr}.md`
        const fileHandle = await chatsHandle.getFileHandle(filename, { create: true })
        
        const writable = await fileHandle.createWritable()
        await writable.write(markdownContent)
        await writable.close()
        
        alert(`Chat archived in your current vault at raw/chats/${filename}`)
      } catch (err: any) {
        console.error('Failed to auto-archive chat log during vault transition:', err)
        alert('Error archiving chat log: ' + err.message + '\nProceeding with transition anyway.')
      }
    }

    setChatMessages([])
    if (type === 'open') {
      await executeSelectFolder()
    } else if (type === 'init') {
      await executeInitNewVault()
    }
  }

  // 3. Scan files recursively from the directory handle
  async function scanFolder(handle: FileSystemDirectoryHandle) {
    const list: FileItem[] = []
    const dirs: string[] = []
    
    async function traverse(dir: FileSystemDirectoryHandle, currentPath = '') {
      for await (const entry of (dir as any).values()) {
        const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name
        if (entry.kind === 'file') {
          if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
            list.push({
              name: entry.name,
              path: relativePath,
              kind: 'file',
              handle: entry,
            })
          }
        } else if (
          entry.kind === 'directory' &&
          !['.obsidian', 'node_modules', '.git', '.next', 'out', '.vercel'].includes(entry.name)
        ) {
          dirs.push(relativePath)
          await traverse(entry, relativePath)
        }
      }
    }

    await traverse(handle)
    list.sort((a, b) => a.path.localeCompare(b.path))
    dirs.sort((a, b) => a.localeCompare(b))
    return { filesList: list, directoriesList: dirs }
  }

  async function loadFiles(handle: FileSystemDirectoryHandle, overrideRaw?: string, overrideWiki?: string) {
    const { filesList, directoriesList } = await scanFolder(handle)

    // Check if wai.md exists, if not initialize it
    const hasWai = filesList.some(f => f.path === 'wai.md')
    if (!hasWai) {
      try {
        const waiFileHandle = await handle.getFileHandle('wai.md', { create: true })
        const writable = await waiFileHandle.createWritable()
        const defaultWaiContent = `---
title: "Who Am I"
date: "${new Date().toISOString().slice(0, 10)}"
type: "profile"
---

# Who Am I

This file defines who you are—your goals, core interests, preferences, and values.

Ember (your Socratic coach) will use this profile to get to know you, personalize the communication, and shape how your digital garden compiles. As you talk with Ember and build your notes, you can update this profile together.

## Core Identity & Background
- **Name**: 
- **Current Focus / Journey**: 

## Values & Priorities
- **What matters most to me**: 
- **Core Principles**: 

## Areas of Curiosity & Study
- **Active Topics**: 
- **Favorite Media / Inspirations**: 

## Interaction Style & Preferences
- **Tone Preference**: (e.g. Challenging Socratic, gentle guide, direct)
- **Formatting Style**: (e.g. Concise paragraphs, structured outlines)

## Profile History & Evolution Log
- **${new Date().toISOString().slice(0, 10)}**: Profile initialized.

---
*Note: Ember will suggest updates to this file as she learns more about you. Approve proposals to save them directly to your vault.*`
        await writable.write(defaultWaiContent)
        await writable.close()
        
        // Rescan to include the newly created wai.md
        const rescanned = await scanFolder(handle)
        setFiles(rescanned.filesList)
        setSubdirs(rescanned.directoriesList)
      } catch (err) {
        console.error('Failed to create default wai.md file:', err)
        setFiles(filesList)
        setSubdirs(directoriesList)
      }
    } else {
      setFiles(filesList)
      setSubdirs(directoriesList)
    }

    if (overrideRaw !== undefined) {
      setRawFolderName(overrideRaw)
    } else {
      // Auto-detect existing folders
      if (directoriesList.includes('raw')) {
        setRawFolderName('raw')
      } else if (directoriesList.length > 0 && !directoriesList.includes('raw')) {
        setRawFolderName('.')
      }
    }
    
    if (overrideWiki !== undefined) {
      setWikiFolderName(overrideWiki)
    } else {
      if (directoriesList.includes('wiki')) {
        setWikiFolderName('wiki')
      }
    }
  }

  // 4. Select a file from the list
  async function selectFile(file: FileItem) {
    try {
      const f = await file.handle.getFile()
      const text = await f.text()
      lastSavedText.current = text
      setSelectedFile(file)
      setEditorText(text)
      setSaveStatus('saved')
      setEditorMode('visual')
    } catch (err: any) {
      alert('Could not read file: ' + err.message)
    }
  }

  function findFileByLinkId(linkId: string): FileItem | undefined {
    const cleanId = linkId.toLowerCase().replace(/\.md$/, '').trim()
    return files.find(f => {
      const fNameClean = f.name.replace(/\.md$/, '').toLowerCase().trim()
      const fPathClean = f.path.replace(/\.md$/, '').toLowerCase().trim()
      return (
        fNameClean === cleanId ||
        fPathClean === cleanId ||
        fPathClean === `${wikiFolderName.toLowerCase()}/${cleanId}` ||
        fPathClean === `${rawFolderName.toLowerCase()}/${cleanId}`
      )
    })
  }

  async function createWikiConceptFile(linkId: string) {
    if (!dirHandle) return
    const cleanName = linkId.endsWith('.md') ? linkId : `${linkId}.md`
    try {
      let wikiHandle = dirHandle
      if (wikiFolderName && wikiFolderName !== '.') {
        const parts = wikiFolderName.split('/')
        for (const part of parts) {
          if (part.trim()) {
            wikiHandle = await wikiHandle.getDirectoryHandle(part, { create: true })
          }
        }
      }
      const newFileHandle = await wikiHandle.getFileHandle(cleanName, { create: true })
      
      let defaultType = 'other'
      if (linkId.toLowerCase().startsWith('work-')) defaultType = 'work'
      else if (linkId.toLowerCase().startsWith('character-')) defaultType = 'character'
      else if (linkId.toLowerCase().startsWith('theme-')) defaultType = 'theme'
      else if (linkId.toLowerCase().startsWith('device-')) defaultType = 'device'
      else if (linkId.toLowerCase().startsWith('global-issue-')) defaultType = 'global-issue'
      else if (linkId.toLowerCase().startsWith('issue-')) defaultType = 'global-issue'

      const title = linkId
        .replace(/^(work|character|theme|device|global-issue|issue)-/i, '')
        .split(/[-_\s]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

      const writable = await newFileHandle.createWritable()
      await writable.write(`---
title: "${title}"
type: "${defaultType}"
sources: []
last_updated: "${new Date().toISOString().slice(0, 10)}"
---

# ${title}
**Summary**: Auto-created concept page for ${title}.

Enter concept details here...

## Related pages
`)
      await writable.close()

      await loadFiles(dirHandle, rawFolderName, wikiFolderName)

      const targetPath = wikiFolderName === '.' ? cleanName : `${wikiFolderName}/${cleanName}`
      const { filesList } = await scanFolder(dirHandle)
      const newFileItem = filesList.find(f => f.path === targetPath)
      if (newFileItem) {
        await selectFile(newFileItem)
        setEditorMode('edit')
      } else {
        alert(`Created ${cleanName}, but could not select it automatically. Please select it from the concept wiki list.`)
      }
    } catch (err: any) {
      alert('Error creating wiki concept file: ' + err.message)
    }
  }

  function findSourceFile(sourceName: string) {
    // Strip .md extension from both sides before comparing so
    // "raw/notes.md" in frontmatter matches the file at raw/notes.md
    const cleanSrc = sourceName.replace(/\.md$/i, '').toLowerCase().trim()
    return files.find(f => {
      const fNameClean = f.name.replace(/\.md$/i, '').toLowerCase().trim()
      const fPathClean = f.path.replace(/\.md$/i, '').toLowerCase().trim()
      return fNameClean === cleanSrc || fPathClean === cleanSrc || fPathClean.endsWith(`/${cleanSrc}`)
    })
  }

  function handleSourceClick(sourceName: string) {
    const matchedFile = findSourceFile(sourceName)
    if (matchedFile) {
      selectFile(matchedFile)
    } else {
      alert(`Source "${sourceName}" is not a file in this vault.`)
    }
  }

  function parseMarkdown(md: string) {
    const lines = md.split('\n')
    let frontmatter: Record<string, any> = {}
    let bodyLines: string[] = []
    
    if (lines[0]?.trim() === '---') {
      let i = 1
      const yamlLines: string[] = []
      while (i < lines.length && lines[i].trim() !== '---') {
        yamlLines.push(lines[i])
        i++
      }
      yamlLines.forEach(line => {
        const parts = line.split(':')
        if (parts.length >= 2) {
          const key = parts[0].trim()
          const value = parts.slice(1).join(':').trim()
          const cleanVal = value.replace(/^["']|["']$/g, '').trim()
          if (key === 'sources') {
            try {
              if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
                frontmatter[key] = JSON.parse(cleanVal)
              } else {
                frontmatter[key] = cleanVal.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
              }
            } catch (e) {
              frontmatter[key] = [cleanVal]
            }
          } else {
            frontmatter[key] = cleanVal
          }
        }
      })
      bodyLines = lines.slice(i + 1)
    } else {
      bodyLines = lines
    }
    
    return {
      frontmatter,
      body: bodyLines.join('\n')
    }
  }

  function getCategoryStyle(type?: string) {
    const t = (type || 'concept').toLowerCase().trim()
    
    // Select color deterministically based on type string hashing
    let hash = 0
    for (let i = 0; i < t.length; i++) {
      hash = t.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    
    let icon = '📝'
    if (t.includes('book') || t.includes('work') || t.includes('read') || t.includes('source') || t.includes('novel')) icon = '📖'
    else if (t.includes('person') || t.includes('author') || t.includes('character') || t.includes('profile') || t.includes('kid') || t.includes('student')) icon = '👤'
    else if (t.includes('theme') || t.includes('idea') || t.includes('concept') || t.includes('key')) icon = '🔑'
    else if (t.includes('device') || t.includes('tool') || t.includes('method') || t.includes('technique')) icon = '🛠️'
    else if (t.includes('issue') || t.includes('problem') || t.includes('global') || t.includes('social')) icon = '🌍'
    else if (t.includes('context') || t.includes('history') || t.includes('event')) icon = '⏳'
    else if (t.includes('quote') || t.includes('citation')) icon = '💬'
    else if (t.includes('data') || t.includes('stat') || t.includes('fact')) icon = '📊'
    else if (t.includes('theory') || t.includes('science') || t.includes('math') || t.includes('logic')) icon = '🔬'
    else if (t.includes('art') || t.includes('music') || t.includes('culture') || t.includes('concert') || t.includes('artist') || t.includes('song')) icon = '🎨'
    else if (t.includes('chat') || t.includes('log') || t.includes('disc')) icon = '🗣️'
    
    const capitalized = t
      .split(/[-_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    return {
      bg: `hsla(${hue}, 60%, 40%, 0.15)`,
      text: `hsl(${hue}, 80%, 75%)`,
      label: `${icon} ${capitalized}`
    }
  }

  function getReadablePluralTitle(key: string): string {
    const k = key.toLowerCase().trim()
    let plural = k
    if (k.endsWith('y') && !k.endsWith('ay') && !k.endsWith('ey') && !k.endsWith('oy') && !k.endsWith('uy')) {
      plural = k.slice(0, -1) + 'ies'
    } else if (k.endsWith('s') || k.endsWith('x') || k.endsWith('z') || k.endsWith('ch') || k.endsWith('sh')) {
      plural = k + 'es'
    } else {
      plural = k + 's'
    }
    return plural
      .split(/[-_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  async function generateIndexContent(refreshedFiles: any[], subject: string) {
    let indexContent = `# Index\n\nWelcome to your ${subject}!\n`
    const categories: Record<string, string[]> = {}

    for (const wf of refreshedFiles) {
      if (wf.name === 'index.md' || wf.name === 'log.md') continue
      const f = await wf.handle.getFile()
      const text = await f.text()
      const typeMatch = text.match(/type:\s*["']?([^"'\r\n#]+)["']?/)
      const titleMatch = text.match(/^#\s+(.+)$/m)
      const summaryMatch = text.match(/\*\*Summary\*\*:\s*(.+)$/m)
      
      let type = 'concept'
      if (typeMatch) {
        type = typeMatch[1].replace(/['"]/g, '').toLowerCase().trim()
      }
      if (!type) type = 'concept'

      const title = titleMatch ? titleMatch[1].trim() : wf.name.replace('.md', '')
      const summary = summaryMatch ? summaryMatch[1].trim() : ''
      
      if (!categories[type]) {
        categories[type] = []
      }
      const bulletText = summary
        ? `- [[${wf.name.replace('.md', '')}]] — ${title}: ${summary}`
        : `- [[${wf.name.replace('.md', '')}]] — ${title}`
      categories[type].push(bulletText)
    }

    const sortedKeys = Object.keys(categories).sort((a, b) => {
      if (a === 'other' || a === 'concept') return 1
      if (b === 'other' || b === 'concept') return -1
      return a.localeCompare(b)
    })

    for (const key of sortedKeys) {
      if (categories[key].length > 0) {
        const heading = getReadablePluralTitle(key)
        indexContent += `\n## ${heading}\n${categories[key].join('\n')}\n`
      }
    }
    return indexContent
  }

  function getVideoEmbed(src: string, alt: string, key: number | string): React.ReactNode | null {
    const ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch) return (
      <div key={key} className="my-4 aspect-video w-full rounded-xl overflow-hidden border border-stone-800 shadow-lg">
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          title={alt || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    )
    const vimeoMatch = src.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return (
      <div key={key} className="my-4 aspect-video w-full rounded-xl overflow-hidden border border-stone-800 shadow-lg">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          title={alt || 'Vimeo video'}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    )
    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src)) return (
      <div key={key} className="my-4 rounded-xl overflow-hidden border border-stone-800 shadow-lg">
        <video controls className="w-full max-h-96 rounded-xl">
          <source src={src} />
          {alt}
        </video>
      </div>
    )
    return null
  }

  function renderInline(text: string): React.ReactNode[] {
    if (!text) return []
    const result: React.ReactNode[] = []
    let remaining = text
    let keyIdx = 0

    while (remaining.length > 0) {
      const imgMatch    = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      const linkMatch   = remaining.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/)
      const boldMatch   = remaining.match(/\*\*([^*]+)\*\*/)
      const italicMatch = remaining.match(/\*([^*]+)\*/)

      let firstMatch: { index: number, length: number, type: 'image' | 'link' | 'bold' | 'italic', matchObj: RegExpMatchArray } | null = null

      if (imgMatch && imgMatch.index !== undefined) {
        firstMatch = { index: imgMatch.index, length: imgMatch[0].length, type: 'image', matchObj: imgMatch }
      }
      if (linkMatch && linkMatch.index !== undefined) {
        if (!firstMatch || linkMatch.index < firstMatch.index)
          firstMatch = { index: linkMatch.index, length: linkMatch[0].length, type: 'link', matchObj: linkMatch }
      }
      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.index)
          firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', matchObj: boldMatch }
      }
      if (italicMatch && italicMatch.index !== undefined) {
        if (!firstMatch || italicMatch.index < firstMatch.index)
          firstMatch = { index: italicMatch.index, length: italicMatch[0].length, type: 'italic', matchObj: italicMatch }
      }

      if (!firstMatch) {
        result.push(remaining)
        break
      }

      if (firstMatch.index > 0) {
        result.push(remaining.substring(0, firstMatch.index))
      }

      if (firstMatch.type === 'image') {
        const alt = firstMatch.matchObj[1]
        const src = firstMatch.matchObj[2]
        const videoEmbed = getVideoEmbed(src, alt, `img-${keyIdx}`)
        if (videoEmbed) {
          keyIdx++
          result.push(videoEmbed)
        } else {
          result.push(
            <LocalImage
              key={`img-${keyIdx++}`}
              src={src}
              alt={alt}
              dirHandle={dirHandle}
              className="max-w-full rounded-lg my-1 border border-stone-800 shadow-md inline-block"
            />
          )
        }
      } else if (firstMatch.type === 'link') {
        const linkId = firstMatch.matchObj[1].trim()
        const label = firstMatch.matchObj[2] ? firstMatch.matchObj[2].trim() : linkId
        const matchedFile = findFileByLinkId(linkId)
        
        if (matchedFile) {
          result.push(
            <button
              key={`link-${keyIdx++}`}
              onClick={() => selectFile(matchedFile)}
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:brightness-125 border animate-fade-in"
              style={{
                background: 'var(--surface2)',
                borderColor: 'var(--border)',
                color: 'var(--accent)'
              }}
              title={`Navigate to ${matchedFile.name}`}
            >
              🔗 {label}
            </button>
          )
        } else {
          result.push(
            <button
              key={`link-${keyIdx++}`}
              onClick={() => {
                const confirmCreate = window.confirm(`Create new concept page for '${linkId}'?`)
                if (confirmCreate) {
                  createWikiConceptFile(linkId)
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:brightness-125 border border-dashed text-red-400"
              style={{
                background: 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: 'rgba(239, 68, 68, 0.8)'
              }}
              title={`Concept '${linkId}' does not exist yet. Click to create.`}
            >
              ❓ {label}
            </button>
          )
        }
      } else if (firstMatch.type === 'bold') {
        const boldText = firstMatch.matchObj[1]
        result.push(<strong key={`bold-${keyIdx++}`} className="font-bold text-amber-500/90">{boldText}</strong>)
      } else if (firstMatch.type === 'italic') {
        const italicText = firstMatch.matchObj[1]
        result.push(<em key={`italic-${keyIdx++}`} className="italic text-stone-200">{italicText}</em>)
      }

      remaining = remaining.substring(firstMatch.index + firstMatch.length)
    }

    return result
  }

  function renderMarkdownBody(text: string) {
    const lines = text.split('\n')
    const blocks: React.ReactNode[] = []
    let currentBlockquote: string[] = []
    let currentList: { type: 'ul' | 'ol', items: string[] } | null = null
    let currentParagraph: string[] = []

    function flushParagraph(key: string | number) {
      if (currentParagraph.length > 0) {
        const content = currentParagraph.join(' ')
        blocks.push(
          <p key={`p-${key}`} className="text-sm leading-relaxed mb-4 text-stone-300">
            {renderInline(content)}
          </p>
        )
        currentParagraph = []
      }
    }

    function flushBlockquote(key: string | number) {
      if (currentBlockquote.length > 0) {
        const content = currentBlockquote.join('\n')
        blocks.push(
          <blockquote key={`bq-${key}`} className="border-l-4 pl-4 italic my-4 text-stone-400 border-amber-500/60 bg-stone-900/40 py-2 pr-3 rounded-r-lg">
            {content.split('\n').map((line, idx) => (
              <div key={idx}>{renderInline(line)}</div>
            ))}
          </blockquote>
        )
        currentBlockquote = []
      }
    }

    function flushList(key: string | number) {
      if (currentList) {
        const ListTag = currentList.type === 'ul' ? 'ul' : 'ol'
        const className = currentList.type === 'ul' ? 'list-disc pl-5 my-3 space-y-1.5 text-stone-300 text-sm' : 'list-decimal pl-5 my-3 space-y-1.5 text-stone-300 text-sm'
        blocks.push(
          <ListTag key={`list-${key}`} className={className}>
            {currentList.items.map((item, idx) => (
              <li key={idx} className="marker:text-amber-500/70">
                {renderInline(item)}
              </li>
            ))}
          </ListTag>
        )
        currentList = null
      }
    }

    function flushAll(key: string | number) {
      flushParagraph(key)
      flushBlockquote(key)
      flushList(key)
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      const imgBlockMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imgBlockMatch) {
        flushAll(i)
        const alt = imgBlockMatch[1]
        const src = imgBlockMatch[2]
        const videoEmbed = getVideoEmbed(src, alt, i)
        if (videoEmbed) {
          blocks.push(videoEmbed)
        } else {
          blocks.push(
            <div key={i} className="my-4 flex justify-center">
              <LocalImage
                src={src}
                alt={alt}
                dirHandle={dirHandle}
                className="max-w-full max-h-96 rounded-xl border border-stone-800 shadow-lg object-contain"
              />
            </div>
          )
        }
        continue
      }

      if (trimmed.startsWith('#')) {
        flushAll(i)
        const match = line.match(/^(#{1,6})\s+(.+)$/)
        if (match) {
          const level = match[1].length
          const headingText = match[2]
          
          if (level === 1) {
            blocks.push(
              <h1 key={i} className="text-2xl font-bold font-serif tracking-tight mt-6 mb-3 pb-1 border-b border-stone-850" style={{ color: 'var(--accent)' }}>
                {renderInline(headingText)}
              </h1>
            )
          } else if (level === 2) {
            blocks.push(
              <h2 key={i} className="text-xl font-semibold font-serif tracking-tight mt-5 mb-2.5" style={{ color: 'var(--accent)' }}>
                {renderInline(headingText)}
              </h2>
            )
          } else {
            blocks.push(
              <h3 key={i} className="text-lg font-medium font-serif mt-4 mb-2 text-stone-200">
                {renderInline(headingText)}
              </h3>
            )
          }
        } else {
          currentParagraph.push(line)
        }
        continue
      }

      if (trimmed.startsWith('>')) {
        flushParagraph(i)
        flushList(i)
        const quoteText = line.slice(line.indexOf('>') + 1).replace(/^\s/, '')
        currentBlockquote.push(quoteText)
        continue
      } else {
        flushBlockquote(i)
      }

      const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/)
      
      if (ulMatch) {
        flushParagraph(i)
        const itemText = ulMatch[2]
        if (!currentList || currentList.type !== 'ul') {
          flushList(i)
          currentList = { type: 'ul', items: [itemText] }
        } else {
          currentList.items.push(itemText)
        }
        continue
      } else if (olMatch) {
        flushParagraph(i)
        const itemText = olMatch[2]
        if (!currentList || currentList.type !== 'ol') {
          flushList(i)
          currentList = { type: 'ol', items: [itemText] }
        } else {
          currentList.items.push(itemText)
        }
        continue
      } else {
        flushList(i)
      }

      if (trimmed === '') {
        flushParagraph(i)
      } else {
        currentParagraph.push(line)
      }
    }

    flushAll('final')
    return blocks
  }

  // 5. Explicitly save active file
  async function saveFile(textToSave: string) {
    if (!selectedFile) return
    if (textToSave === lastSavedText.current && saveStatus === 'saved') return
    setSaveStatus('saving')
    try {
      const writable = await selectedFile.handle.createWritable()
      await writable.write(textToSave)
      await writable.close()
      lastSavedText.current = textToSave
      setSaveStatus('saved')
      
      // Update file list contents in background for the graph
      if (dirHandle) loadFiles(dirHandle, rawFolderName, wikiFolderName)
    } catch (err) {
      console.error(err)
      setSaveStatus('error')
    }
  }

  // Auto-save on change
  useEffect(() => {
    if (!selectedFile) return
    const timeout = setTimeout(() => {
      saveFile(editorText)
    }, 1500) // autosave after 1.5s of no typing

    return () => clearTimeout(timeout)
  }, [editorText])

  // Save shortcut (Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (selectedFile) {
          saveFile(editorText)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFile, editorText])

  // Create a new raw source file
  async function createRawFile() {
    if (!dirHandle) return
    const name = prompt('Enter filename (e.g. macbeth-act1.md):')
    if (!name) return
    const cleanName = name.endsWith('.md') ? name : `${name}.md`
    try {
      let rawHandle = dirHandle
      if (rawFolderName && rawFolderName !== '.') {
        const parts = rawFolderName.split('/')
        for (const part of parts) {
          if (part.trim()) {
            rawHandle = await rawHandle.getDirectoryHandle(part, { create: true })
          }
        }
      }
      const newFileHandle = await rawHandle.getFileHandle(cleanName, { create: true })
      
      // Write default frontmatter
      const writable = await newFileHandle.createWritable()
      await writable.write(`---
title: "${cleanName.replace('.md', '')}"
date: "${new Date().toISOString().slice(0, 10)}"
type: "raw-source"
---

# ${cleanName.replace('.md', '')}

Enter your source details here...`)
      await writable.close()

      await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      alert(`Created file: ${rawFolderName === '.' ? '' : rawFolderName + '/'}${cleanName}`)
    } catch (err: any) {
      alert('Error creating file: ' + err.message)
    }
  }

  async function saveImportedFile(file: File) {
    if (!dirHandle) return
    try {
      let rawHandle = dirHandle
      if (rawFolderName && rawFolderName !== '.') {
        const parts = rawFolderName.split('/')
        for (const part of parts) {
          if (part.trim()) {
            rawHandle = await rawHandle.getDirectoryHandle(part, { create: true })
          }
        }
      }
      const newFileHandle = await rawHandle.getFileHandle(file.name, { create: true })
      
      const writable = await newFileHandle.createWritable()
      const content = await file.text()
      await writable.write(content)
      await writable.close()

      await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      alert(`Successfully imported: ${file.name}`)
    } catch (err: any) {
      alert('Error importing file: ' + err.message)
    }
  }

  async function insertFromLocalDisk() {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Markdown and Text Files',
              accept: {
                'text/markdown': ['.md'],
                'text/plain': ['.txt']
              }
            }
          ],
          multiple: false
        })
        if (fileHandle) {
          const file = await fileHandle.getFile()
          await saveImportedFile(file)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          fileInputRef.current?.click()
        }
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  async function importDocxFile() {
    if (!dirHandle) {
      alert('Please open a vault folder first.')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx'

    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        setConsoleLogs(prev => [...prev, `⏳ Uploading and parsing ${file.name}...`])
        setIsCompiling(true)

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/import-docx', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Server conversion failed')
        }

        const result = await response.json()
        const { markdown, images } = result

        // 1. Write images
        let imagesHandle: FileSystemDirectoryHandle
        try {
          imagesHandle = await dirHandle.getDirectoryHandle('images', { create: true })
        } catch (err: any) {
          throw new Error(`Failed to create images/ folder in vault: ${err.message}`)
        }

        if (images && images.length > 0) {
          setConsoleLogs(prev => [...prev, `⚙️ Writing ${images.length} extracted images...`])
          for (const img of images) {
            const imgFileHandle = await imagesHandle.getFileHandle(img.filename, { create: true })
            const writable = await imgFileHandle.createWritable()
            const res = await fetch(img.base64)
            const blob = await res.blob()
            await writable.write(blob)
            await writable.close()
          }
        }

        // 2. Write Markdown file
        let rawHandle = dirHandle
        if (rawFolderName && rawFolderName !== '.') {
          const parts = rawFolderName.split('/')
          for (const part of parts) {
            if (part.trim()) {
              rawHandle = await rawHandle.getDirectoryHandle(part, { create: true })
            }
          }
        }

        const cleanName = file.name.replace(/\.docx$/i, '').replace(/[^a-zA-Z0-9_\-\s]/g, '') + '.md'
        const markdownFileHandle = await rawHandle.getFileHandle(cleanName, { create: true })
        const markdownWritable = await markdownFileHandle.createWritable()
        const fileTitle = cleanName.replace('.md', '')
        const frontmatter = `---
title: "${fileTitle}"
date: "${new Date().toISOString().slice(0, 10)}"
type: "raw-source"
---

# ${fileTitle}

`
        await markdownWritable.write(frontmatter + markdown)
        await markdownWritable.close()

        setConsoleLogs(prev => [...prev, `✓ Successfully imported and created: ${rawFolderName === '.' ? '' : rawFolderName + '/'}${cleanName}`])
        setIsCompiling(false)
        await loadFiles(dirHandle, rawFolderName, wikiFolderName)
        alert(`Imported ${file.name} successfully! Extracted ${images ? images.length : 0} images.`)
      } catch (err: any) {
        console.error(err)
        setConsoleLogs(prev => [...prev, `❌ Error importing .docx: ${err.message}`])
        setIsCompiling(false)
        alert(`Error importing Word Document: ${err.message}`)
      }
    }

    input.click()
  }

  // 6. Socratic Compiler (Stateless AI integration)
  async function getWikiHandle() {
    if (!dirHandle) return null
    let wikiHandle = dirHandle
    if (wikiFolderName && wikiFolderName !== '.') {
      const parts = wikiFolderName.split('/')
      for (const part of parts) {
        if (part.trim()) {
          wikiHandle = await wikiHandle.getDirectoryHandle(part, { create: true })
        }
      }
    }
    return wikiHandle
  }

  async function reindexWiki() {
    const wikiHandle = await getWikiHandle()
    if (!wikiHandle) {
      setConsoleLogs(prev => [...prev, 'Error: No vault/wiki folder opened.'])
      return
    }
    try {
      const indexFileHandle = await wikiHandle.getFileHandle('index.md', { create: true })
      const writable = await indexFileHandle.createWritable()
      
      const refreshedFiles = await scanDirectoryForWiki(wikiHandle)
      const indexContent = await generateIndexContent(refreshedFiles, gardenSubject)
      
      await writable.write(indexContent)
      await writable.close()
      
      setConsoleLogs(prev => [...prev, `✓ Re-indexed ${wikiFolderName === '.' ? '' : wikiFolderName + '/'}index.md`])
      if (dirHandle) await loadFiles(dirHandle, rawFolderName, wikiFolderName)
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `❌ Reindexing error: ${err.message}`])
    }
  }

  async function getVaultStatusData(latestFiles: FileItem[]): Promise<VaultStatusData> {
    const rawFiles = latestFiles.filter(f => {
      if (rawFolderName === '.') {
        return !f.path.startsWith(wikiFolderName + '/') && !f.path.includes('/')
      }
      return f.path.startsWith(rawFolderName + '/')
    })

    const wikiFiles = latestFiles.filter(f => {
      if (wikiFolderName === '.') {
        return !f.path.startsWith(rawFolderName + '/') && !f.path.includes('/')
      }
      return f.path.startsWith(wikiFolderName + '/')
    })

    // Extract all referenced sources from existing wiki pages
    const referencedSources = new Set<string>()
    await Promise.all(
      wikiFiles.map(async (wf) => {
        if (wf.name === 'index.md' || wf.name === 'log.md' || wf.name === '.garden-config.json') return
        try {
          const fileObj = await wf.handle.getFile()
          const text = await fileObj.text()
          const { frontmatter } = parseMarkdown(text)
          const sources = frontmatter.sources
          if (Array.isArray(sources)) {
            sources.forEach(src => {
              if (typeof src === 'string') {
                referencedSources.add(src.toLowerCase().trim())
              }
            })
          }
        } catch (e) {
          console.error('Failed to parse sources from wiki page:', wf.name, e)
        }
      })
    )

    const logFile = latestFiles.find(f => f.path === (wikiFolderName === '.' ? 'log.md' : `${wikiFolderName}/log.md`))

    let lastCompileTime = 0
    if (logFile) {
      const file = await logFile.handle.getFile()
      const text = await file.text()
      const matches = [...text.matchAll(/Last Compile: (\d+)/g)]
      if (matches.length > 0) {
        lastCompileTime = parseInt(matches[matches.length - 1][1])
      }
    }

    const pending: string[] = []
    const upToDate: string[] = []
    await Promise.all(
      rawFiles.map(async (rf) => {
        try {
          const fileObj = await rf.handle.getFile()
          const isReferenced = referencedSources.has(rf.name.toLowerCase().trim())
          if (fileObj.lastModified > lastCompileTime || !isReferenced) {
            pending.push(rf.name)
          } else {
            upToDate.push(rf.name)
          }
        } catch (e) {
          console.error('Failed to read raw file during status check:', rf.name, e)
        }
      })
    )

    return {
      lastCompileTime,
      rawFilesCount: rawFiles.length,
      pending,
      upToDate
    }
  }

  async function checkStatus() {
    if (!dirHandle) {
      setConsoleLogs(prev => [...prev, 'Error: No vault opened.'])
      return
    }
    try {
      const { filesList: latestFiles, directoriesList: latestDirs } = await scanFolder(dirHandle)
      setFiles(latestFiles)
      setSubdirs(latestDirs)

      const statusData = await getVaultStatusData(latestFiles)

      setConsoleLogs(prev => [
        ...prev,
        `Last Compile Time: ${statusData.lastCompileTime ? new Date(statusData.lastCompileTime).toLocaleString() : 'Never'}`,
        `Total raw files found: ${statusData.rawFilesCount}`,
        `  - Pending compile (modified/uncompiled): ${statusData.pending.length} (${statusData.pending.join(', ') || 'none'})`,
        `  - Up to date: ${statusData.upToDate.length}`
      ])
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `❌ Status check error: ${err.message}`])
    }
  }

  async function appendLogEntry(msg: string) {
    if (!dirHandle) return
    try {
      let wikiHandle = dirHandle
      if (wikiFolderName && wikiFolderName !== '.') {
        const parts = wikiFolderName.split('/')
        for (const part of parts) {
          if (part.trim()) {
            wikiHandle = await wikiHandle.getDirectoryHandle(part.trim(), { create: true })
          }
        }
      }
      const logFileHandle = await wikiHandle.getFileHandle('log.md', { create: true })
      const f = await logFileHandle.getFile()
      const existingLog = await f.text()
      const separator = existingLog.endsWith('\n') ? '' : '\n'
      const timestamp = new Date().toISOString()
      const newEntry = `- ${msg} (at ${timestamp})\n`
      const writable = await logFileHandle.createWritable()
      await writable.write(`${existingLog}${separator}${newEntry}`)
      await writable.close()
    } catch (e) {
      console.error('Failed to append log entry:', e)
    }
  }

  // File deletion helper
  async function deleteFile(file: FileItem) {
    if (!dirHandle) return
    if (file.name === 'index.md' || file.name === 'log.md' || file.name === '.garden-config.json') {
      alert(`Cannot delete critical system file: ${file.name}`)
      return
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete "${file.path}"? This cannot be undone.`)
    if (!confirmDelete) return

    try {
      const parts = file.path.split('/')
      const fileName = parts.pop()!
      let currentDir = dirHandle
      for (const part of parts) {
        if (part.trim()) {
          currentDir = await currentDir.getDirectoryHandle(part.trim())
        }
      }
      await currentDir.removeEntry(fileName)
      await appendLogEntry(`[User Deleted] file: ${file.path}`)
      
      if (selectedFile?.path === file.path) {
        setSelectedFile(null)
        setEditorText('')
      }
      
      await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      setConsoleLogs(prev => [...prev, `✓ Deleted file: ${file.path}`])
    } catch (err: any) {
      alert('Could not delete file: ' + err.message)
      setConsoleLogs(prev => [...prev, `❌ Error deleting file: ${err.message}`])
    }
  }

  // File rename helper
  async function renameFile(oldPath: string, newPath: string) {
    if (!dirHandle) return
    if (oldPath === 'index.md' || oldPath === 'log.md' || oldPath === '.garden-config.json') {
      alert(`Cannot rename critical system file: ${oldPath}`)
      return
    }
    try {
      const oldParts = oldPath.split('/')
      const oldName = oldParts.pop()!
      let oldDir = dirHandle
      for (const part of oldParts) {
        if (part.trim()) {
          oldDir = await oldDir.getDirectoryHandle(part.trim())
        }
      }
      const oldFileHandle = await oldDir.getFileHandle(oldName)
      const file = await oldFileHandle.getFile()
      const content = await file.text()

      const newParts = newPath.split('/')
      const newName = newParts.pop()!
      let newDir = dirHandle
      for (const part of newParts) {
        if (part.trim()) {
          newDir = await newDir.getDirectoryHandle(part.trim(), { create: true })
        }
      }
      const newFileHandle = await newDir.getFileHandle(newName, { create: true })
      const writable = await newFileHandle.createWritable()
      await writable.write(content)
      await writable.close()

      await oldDir.removeEntry(oldName)
      await appendLogEntry(`[User Renamed] file: ${oldPath} -> ${newPath}`)

      if (selectedFile?.path === oldPath) {
        const { filesList } = await scanFolder(dirHandle)
        const newFileItem = filesList.find(f => f.path === newPath)
        if (newFileItem) {
          await selectFile(newFileItem)
        } else {
          setSelectedFile(null)
          setEditorText('')
        }
      }

      await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      setConsoleLogs(prev => [...prev, `✓ Renamed file: ${oldPath} -> ${newPath}`])
    } catch (err: any) {
      alert('Could not rename file: ' + err.message)
      setConsoleLogs(prev => [...prev, `❌ Error renaming file: ${err.message}`])
    }
  }

  // Search vault helper
  async function searchVault(query: string) {
    if (!dirHandle) return
    setConsoleLogs(prev => [...prev, `Searching for "${query}"...`])
    try {
      const { filesList } = await scanFolder(dirHandle)
      const matches: string[] = []
      for (const f of filesList) {
        const fileObj = await f.handle.getFile()
        const text = await fileObj.text()
        if (text.toLowerCase().includes(query.toLowerCase())) {
          const lines = text.split('\n')
          let count = 0
          lines.forEach(line => {
            if (line.toLowerCase().includes(query.toLowerCase())) count++
          })
          matches.push(`${f.path} (${count} match${count > 1 ? 'es' : ''})`)
        }
      }
      if (matches.length === 0) {
        setConsoleLogs(prev => [...prev, `No matches found for "${query}".`])
      } else {
        setConsoleLogs(prev => [...prev, `Found in ${matches.length} file(s):`, ...matches.map(m => `  - ${m}`)])
      }
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `❌ Search error: ${err.message}`])
    }
  }

  // Linting helper
  async function runLint() {
    if (!dirHandle) return
    setConsoleLogs(prev => [...prev, 'Starting wiki audit / linting...'])
    try {
      const { filesList } = await scanFolder(dirHandle)
      const wikiFiles = filesList.filter(f => {
        if (wikiFolderName === '.') {
          return !f.path.startsWith(rawFolderName + '/') && !f.path.includes('/')
        }
        return f.path.startsWith(wikiFolderName + '/')
      })

      if (wikiFiles.length === 0) {
        setConsoleLogs(prev => [...prev, '✓ Lint completed: No wiki files found to audit.'])
        return
      }

      const fileContents = await Promise.all(
        wikiFiles.map(async (f) => {
          try {
            const file = await f.handle.getFile()
            const text = await file.text()
            return { file: f, text }
          } catch (e) {
            return { file: f, text: '' }
          }
        })
      )

      const lintErrors: string[] = []
      const allWikiLinks = new Set<string>()
      const existingWikiNames = new Set<string>()

      for (const wf of wikiFiles) {
        const cleanName = wf.name.toLowerCase().replace(/\.md$/, '').trim()
        existingWikiNames.add(cleanName)
      }

      for (const { file, text } of fileContents) {
        const cleanName = file.name.toLowerCase().replace(/\.md$/, '').trim()
        if (cleanName === 'index' || cleanName === 'log') continue

        const hasFrontmatter = text.startsWith('---') || text.includes('\n---')
        const hasSummary = text.toLowerCase().includes('summary:') || text.toLowerCase().includes('**summary**')
        const hasSources = text.toLowerCase().includes('sources:') || text.toLowerCase().includes('**sources**')

        if (!hasFrontmatter) {
          lintErrors.push(`[Format] ${file.path}: Missing frontmatter metadata block (---)`)
        }
        if (!hasSummary) {
          lintErrors.push(`[Format] ${file.path}: Missing 'Summary' statement`)
        }
        if (!hasSources) {
          lintErrors.push(`[Format] ${file.path}: Missing 'Sources' references`)
        }

        const linkMatches = text.match(/\[\[(.*?)\]\]/g)
        if (linkMatches) {
          for (const match of linkMatches) {
            const target = match.slice(2, -2).trim().toLowerCase()
            if (target && target !== 'index' && target !== 'log') {
              allWikiLinks.add(target)
              if (!existingWikiNames.has(target)) {
                lintErrors.push(`[Link] ${file.name}: References non-existent concept [[${target}]]`)
              }
            }
          }
        }
      }

      for (const wf of wikiFiles) {
        const cleanName = wf.name.toLowerCase().replace(/\.md$/, '').trim()
        if (cleanName === 'index' || cleanName === 'log') continue

        if (!allWikiLinks.has(cleanName)) {
          lintErrors.push(`[Orphan] ${wf.path}: Page is not linked from any other concept page`)
        }
      }

      if (lintErrors.length === 0) {
        setConsoleLogs(prev => [
          ...prev,
          '✓ Lint completed: All checks passed! 0 issues found.'
        ])
      } else {
        setConsoleLogs(prev => [
          ...prev,
          `⚠️ Lint completed: Found ${lintErrors.length} issues:`,
          ...lintErrors.map(err => `  ${err}`)
        ])
      }
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `❌ Lint error: ${err.message}`])
    }
  }

  async function handleGardenCommand(text: string) {
    if (!text.trim()) return
    setConsoleLogs(prev => [...prev, `> ${text}`])

    const lowerText = text.toLowerCase()

    if (lowerText.startsWith('#help') || text.startsWith('help') || text.startsWith('how')) {
      setConsoleLogs(prev => [
        ...prev,
        'Available Commands:',
        '  #compile [instruction] - Incremental compile of new/changed sources.',
        '  #compile-force - Force compilation of all raw sources.',
        '  #reindex - Regenerate wiki index.md and log.md files.',
        '  #status - Check for new/modified raw files since last compile.',
        '  #lint - Audit vault for format, orphan files, and broken links.',
        '  #delete [path] - Delete a file by its relative path.',
        '  #create [path] - Create a new blank file at the specified path.',
        '  #rename [old-path] [new-path] - Rename a file in the vault.',
        '  #search [query] - Search vault files for text query.',
        '  #help - Display this help message.'
      ])
    } else if (lowerText.startsWith('#delete')) {
      const pathArg = text.replace('#delete', '').trim()
      if (!pathArg) {
        setConsoleLogs(prev => [...prev, '❌ Usage: #delete path/filename.md'])
        return
      }
      if (pathArg === 'index.md' || pathArg === 'log.md' || pathArg === '.garden-config.json') {
        setConsoleLogs(prev => [...prev, `❌ Cannot delete critical system file: ${pathArg}`])
        return
      }
      const confirmDelete = window.confirm(`Are you sure you want to delete "${pathArg}"? This cannot be undone.`)
      if (!confirmDelete) return
      
      try {
        if (!dirHandle) throw new Error('No vault folder open')
        const parts = pathArg.split('/')
        const fileName = parts.pop()!
        let currentDir: FileSystemDirectoryHandle | null = dirHandle
        for (const part of parts) {
          if (part.trim() && currentDir) {
            currentDir = await currentDir.getDirectoryHandle(part.trim())
          }
        }
        if (!currentDir) throw new Error('Invalid directory path')
        await currentDir.removeEntry(fileName)
        await appendLogEntry(`[User Deleted] file: ${pathArg}`)
        
        if (selectedFile && selectedFile.path === pathArg) {
          setSelectedFile(null)
          setEditorText('')
        }
        
        await loadFiles(dirHandle, rawFolderName, wikiFolderName)
        setConsoleLogs(prev => [...prev, `✓ Deleted file: ${pathArg}`])
      } catch (err: any) {
        setConsoleLogs(prev => [...prev, `❌ Error deleting file: ${err.message}`])
      }
    } else if (lowerText.startsWith('#create')) {
      const pathArg = text.replace('#create', '').trim()
      if (!pathArg) {
        setConsoleLogs(prev => [...prev, '❌ Usage: #create path/filename.md'])
        return
      }
      try {
        if (!dirHandle) throw new Error('No vault folder open')
        const parts = pathArg.split('/')
        const fileName = parts.pop()!
        let currentDir: FileSystemDirectoryHandle | null = dirHandle
        for (const part of parts) {
          if (part.trim() && currentDir) {
            currentDir = await currentDir.getDirectoryHandle(part.trim(), { create: true })
          }
        }
        if (!currentDir) throw new Error('Invalid directory path')
        const fileHandle = await currentDir.getFileHandle(fileName, { create: true })
        
        if (fileName.endsWith('.md')) {
          const writable = await fileHandle.createWritable()
          await writable.write(`---
title: "${fileName.replace('.md', '')}"
type: "other"
date: "${new Date().toISOString().split('T')[0]}"
---
`)
          await writable.close()
        }
        await appendLogEntry(`[User Created] file: ${pathArg}`)
        
        await loadFiles(dirHandle, rawFolderName, wikiFolderName)
        setConsoleLogs(prev => [...prev, `✓ Created file: ${pathArg}`])
      } catch (err: any) {
        setConsoleLogs(prev => [...prev, `❌ Error creating file: ${err.message}`])
      }
    } else if (lowerText.startsWith('#rename')) {
      const argsStr = text.slice(7).trim()
      const parts = argsStr.split(/\s+/)
      if (parts.length < 2) {
        setConsoleLogs(prev => [...prev, '❌ Usage: #rename path/old.md path/new.md'])
        return
      }
      const [oldPath, newPath] = parts
      await renameFile(oldPath, newPath)
    } else if (lowerText.startsWith('#search')) {
      const query = text.slice(7).trim()
      if (!query) {
        setConsoleLogs(prev => [...prev, '❌ Usage: #search query'])
        return
      }
      await searchVault(query)
    } else if (lowerText.startsWith('#log')) {
      const logMessage = text.slice(4).trim()
      if (!logMessage) {
        setConsoleLogs(prev => [...prev, '❌ Usage: #log [message to append]'])
        return
      }
      try {
        let wikiHandle = dirHandle
        if (wikiFolderName && wikiFolderName !== '.') {
          const parts = wikiFolderName.split('/')
          for (const part of parts) {
            if (part.trim()) {
              wikiHandle = await wikiHandle!.getDirectoryHandle(part.trim(), { create: true })
            }
          }
        }
        const logFileHandle = await wikiHandle!.getFileHandle('log.md', { create: true })
        const f = await logFileHandle.getFile()
        const existingLog = await f.text()
        const writable = await logFileHandle.createWritable()
        const timestamp = new Date().toISOString()
        await writable.write(`${existingLog}\n- [Manual] ${timestamp}: ${logMessage}\n`)
        await writable.close()
        
        await loadFiles(dirHandle!, rawFolderName, wikiFolderName)
        setConsoleLogs(prev => [...prev, `✓ Appended manual log entry to log.md`])
      } catch (err: any) {
        setConsoleLogs(prev => [...prev, `❌ Error writing log: ${err.message}`])
      }
    } else if (lowerText.startsWith('#config')) {
      setConsoleLogs(prev => [
        ...prev,
        `Current Configuration:`,
        `  Subject/Domain: ${gardenSubject}`,
        `  Raw Folder: ${rawFolderName}`,
        `  Wiki Folder: ${wikiFolderName}`
      ])
    } else if (lowerText.includes('#status') || lowerText.includes('status') || lowerText.includes('check') || lowerText.includes("what's new")) {
      setConsoleLogs(prev => [...prev, 'Scanning vault for status...'])
      await checkStatus()
    } else if (lowerText.includes('#reindex') || lowerText.includes('reindex') || lowerText.includes('re-index')) {
      setConsoleLogs(prev => [...prev, 'Starting re-indexing...'])
      await reindexWiki()
    } else if (lowerText.includes('#compile-force')) {
      const instruction = text.replace('#compile-force', '').trim()
      setConsoleLogs(prev => [...prev, `Starting force compilation... ${instruction ? 'Instruction: ' + instruction : ''}`])
      await compileVault(true, instruction)
    } else if (lowerText.includes('#lint')) {
      await runLint()
    } else if (
      lowerText.includes('#compile') ||
      lowerText.includes('compile') ||
      lowerText.includes('check again') ||
      lowerText.includes('i added a new source')
    ) {
      let instruction = text
      const keywords = ['#compile', 'compile', 'check again', 'i added a new source']
      for (const kw of keywords) {
        const idx = instruction.toLowerCase().indexOf(kw)
        if (idx !== -1) {
          instruction = instruction.substring(0, idx) + ' ' + instruction.substring(idx + kw.length)
        }
      }
      instruction = instruction.replace(/\s+/g, ' ').trim()
      
      setConsoleLogs(prev => [...prev, `Starting compile... ${instruction ? 'Instruction: ' + instruction : ''}`])
      await compileVault(false, instruction)
    } else {
      setConsoleLogs(prev => [
        ...prev,
        `Routing query to Socratic Coach (Ember)...`
      ])
      setActiveTab('chat')
      await sendChatMessage(text)
    }
  }

  async function compileVault(force: boolean | any = false, instruction = '') {
    const isForce = force === true
    if (!dirHandle) return
    setIsCompiling(true)
    setCompileLog(['Refreshing files and directories...'])
    setConsoleLogs(prev => [...prev, 'Refreshing files and directories...'])

    try {
      // 1. Refresh files from the directory handle immediately to pick up external changes
      const { filesList: latestFiles, directoriesList: latestDirs } = await scanFolder(dirHandle)
      setFiles(latestFiles)
      setSubdirs(latestDirs)

      // Calculate dynamic lists using refreshed files
      const rawFiles = latestFiles.filter(f => {
        if (rawFolderName === '.') {
          return !f.path.startsWith(wikiFolderName + '/') && !f.path.includes('/')
        }
        return f.path.startsWith(rawFolderName + '/')
      })

      const wikiFiles = latestFiles.filter(f => {
        if (wikiFolderName === '.') {
          return !f.path.startsWith(rawFolderName + '/') && !f.path.includes('/')
        }
        return f.path.startsWith(wikiFolderName + '/')
      })

      const logFile = latestFiles.find(f => f.path === (wikiFolderName === '.' ? 'log.md' : `${wikiFolderName}/log.md`))

      // Extract all referenced sources from existing wiki pages
      const referencedSources = new Set<string>()
      await Promise.all(
        wikiFiles.map(async (wf) => {
          if (wf.name === 'index.md' || wf.name === 'log.md' || wf.name === '.garden-config.json') return
          try {
            const fileObj = await wf.handle.getFile()
            const text = await fileObj.text()
            const { frontmatter } = parseMarkdown(text)
            const sources = frontmatter.sources
            if (Array.isArray(sources)) {
              sources.forEach(src => {
                if (typeof src === 'string') {
                  referencedSources.add(src.toLowerCase().trim())
                }
              })
            }
          } catch (e) {
            console.error('Failed to parse sources from wiki page:', wf.name, e)
          }
        })
      )

      let lastCompileTime = 0
      if (logFile) {
        const file = await logFile.handle.getFile()
        const text = await file.text()
        const matches = [...text.matchAll(/Last Compile: (\d+)/g)]
        if (matches.length > 0) {
          lastCompileTime = parseInt(matches[matches.length - 1][1])
        }
      }

      const sanitizeContent = (s: string) => s.replace(/\0/g, '').replace(/[\uD800-\uDFFF]/g, '?')

      const pending: Array<{ name: string; content: string }> = []
      await Promise.all(
        rawFiles.map(async (rf) => {
          try {
            const fileObj = await rf.handle.getFile()
            const isReferenced = referencedSources.has(rf.name.toLowerCase().trim())
            if (isForce || fileObj.lastModified > lastCompileTime || !isReferenced) {
              const content = sanitizeContent(await fileObj.text())
              pending.push({ name: rf.name, content })
            }
          } catch (e) {
            console.error('Failed to read raw file:', rf.name, e)
          }
        })
      )

      if (pending.length === 0) {
        const msg1 = 'Everything is up to date. No new raw sources to process.'
        const msg2 = 'Compilation completed.'
        setCompileLog(prev => [...prev, msg1, msg2])
        setConsoleLogs(prev => [...prev, msg1, msg2])
        setIsCompiling(false)
        return
      }

      const msgCount = `Found ${pending.length} files modified since last compile.`
      const msgRead = 'Reading existing wiki garden content...'
      setCompileLog(prev => [...prev, msgCount, msgRead])
      setConsoleLogs(prev => [...prev, msgCount, msgRead])

      // 2. Gather existing wiki concepts to pass as compiler context for intelligent merging and linking
      const existingWikiDocs: Array<{ name: string; content: string }> = []
      await Promise.all(
        wikiFiles.map(async (wf) => {
          if (wf.name === 'index.md' || wf.name === 'log.md') return
          try {
            const fileObj = await wf.handle.getFile()
            const text = sanitizeContent(await fileObj.text())
            existingWikiDocs.push({ name: wf.name, content: text })
          } catch (e) {
            console.error('Failed to read existing wiki concept page:', wf.name, e)
          }
        })
      )

      const msgProcess = 'Processing through DeepSeek (merging and linking)...'
      setCompileLog(prev => [...prev, msgProcess])
      setConsoleLogs(prev => [...prev, msgProcess])

      // Call Stateless API compilation endpoint with raw files and existing garden state
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          files: pending,
          existingWiki: existingWikiDocs,
          instruction,
          gardenSubject
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server compile error')

      const msgWriting = 'Writing compiled wiki pages to disk...'
      setCompileLog(prev => [...prev, msgWriting])
      setConsoleLogs(prev => [...prev, msgWriting])
      
      let wikiHandle = dirHandle
      if (wikiFolderName && wikiFolderName !== '.') {
        const parts = wikiFolderName.split('/')
        for (const part of parts) {
          if (part.trim()) {
            wikiHandle = await wikiHandle.getDirectoryHandle(part, { create: true })
          }
        }
      }

      // Write compiled pages (Intelligent AI merge is written directly as clean pages)
      for (const [id, page] of Object.entries(data.compiled) as any) {
        const fileHandle = await wikiHandle.getFileHandle(`${id}.md`, { create: true })
        
        // Write the clean compiled/merged structure
        const pageLinks = [...(page.relatedLinks || [])]
        if (!pageLinks.includes('index')) {
          pageLinks.push('index')
        }
        const links = pageLinks.map((l: string) => `- [[${l}]]`).join('\n')
        const content = `---
title: "${page.title}"
type: "${page.type}"
sources: ${JSON.stringify(page.sources)}
last_updated: "${new Date().toISOString().slice(0, 10)}"
---

# ${page.title}
**Summary**: ${page.summary}

${page.content}

## Related pages
${links}`

        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()

        // Verify the content changes are persisted properly by reading them back
        const verifyFile = await fileHandle.getFile()
        const verifyContent = await verifyFile.text()
        if (verifyContent !== content) {
          throw new Error(`Verification failed: Content of ${id}.md was not saved correctly.`)
        }

        const msgVerify = `✓ Verified and Updated/Created ${wikiFolderName === '.' ? '' : wikiFolderName + '/'}${id}.md`
        setCompileLog(prev => [...prev, msgVerify])
        setConsoleLogs(prev => [...prev, msgVerify])
      }

      // Re-write log.md
      const timestamp = Date.now()
      const logMsg = `\n- Compiled on ${new Date().toISOString()}: Processed ${pending.length} sources. Last Compile: ${timestamp}\n`
      let existingLog = ''
      
      try {
        const logFileHandle = await wikiHandle.getFileHandle('log.md', { create: true })
        const f = await logFileHandle.getFile()
        existingLog = await f.text()
        const writable = await logFileHandle.createWritable()
        await writable.write(`${existingLog}${logMsg}`)
        await writable.close()
      } catch (err) {
        console.error(err)
      }

      // Re-write index.md
      try {
        const indexFileHandle = await wikiHandle.getFileHandle('index.md', { create: true })
        const writable = await indexFileHandle.createWritable()
        
        const refreshedFiles = await scanDirectoryForWiki(wikiHandle)
        const indexContent = await generateIndexContent(refreshedFiles, gardenSubject)
        
        await writable.write(indexContent)
        await writable.close()
        const msgIndex = `✓ Re-indexed ${wikiFolderName === '.' ? '' : wikiFolderName + '/'}index.md`
        setCompileLog(prev => [...prev, msgIndex])
        setConsoleLogs(prev => [...prev, msgIndex])
      } catch (err) {
        console.error(err)
      }

      const msgSuccess = 'Compilation successfully completed! ✅'
      setCompileLog(prev => [...prev, msgSuccess])
      setConsoleLogs(prev => [...prev, msgSuccess])
      
      const { filesList: finalFilesList, directoriesList: finalDirsList } = await scanFolder(dirHandle)
      setFiles(finalFilesList)
      setSubdirs(finalDirsList)

      // Maintain configured folders, only fallback if not set
      if (!rawFolderName) {
        if (finalDirsList.includes('raw')) {
          setRawFolderName('raw')
        } else if (finalDirsList.length > 0) {
          setRawFolderName('.')
        }
      }
      
      if (!wikiFolderName) {
        if (finalDirsList.includes('wiki')) {
          setWikiFolderName('wiki')
        }
      }

      // Reload active/selected file if it was updated
      if (selectedFile) {
        const updatedFile = finalFilesList.find(f => f.path === selectedFile.path)
        if (updatedFile) {
          try {
            const f = await updatedFile.handle.getFile()
            const text = await f.text()
            lastSavedText.current = text
            setSelectedFile(updatedFile)
            setEditorText(text)
            setSaveStatus('saved')
          } catch (e) {
            console.error('Failed to reload selected file after compilation:', e)
          }
        }
      }
    } catch (err: any) {
      const msgError = `❌ Error: ${err.message}`
      setCompileLog(prev => [...prev, msgError])
      setConsoleLogs(prev => [...prev, msgError])
    }
    setIsCompiling(false)
    setTimeout(() => setCompileLog([]), 6000)
  }

  // Simple scan helper
  async function scanDirectoryForWiki(wikiDir: FileSystemDirectoryHandle) {
    const list = []
    for await (const entry of (wikiDir as any).values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        list.push({ name: entry.name, handle: entry })
      }
    }
    return list
  }

  interface ProposedAction {
    type: 'CREATE' | 'WRITE' | 'DELETE' | 'COMPILE' | 'REINDEX' | 'STATUS' | 'LINT' | 'RENAME'
    path: string
    content: string
  }

  function parseMessageActions(text: string) {
    const actions: ProposedAction[] = []
    const rx = /\[ACTION:\s*(CREATE|WRITE|DELETE|COMPILE|REINDEX|STATUS|LINT|RENAME)\s*([^\]]*)\]\n?([\s\S]*?)\n?\[END_ACTION\]/gi
    let match
    while ((match = rx.exec(text)) !== null) {
      actions.push({
        type: match[1].toUpperCase() as any,
        path: (match[2] || '').trim(),
        content: match[3]
      })
    }
    const cleanText = text.replace(rx, '').trim()
    return { cleanText, actions }
  }

  async function executeAgentAction(action: ProposedAction, msgIdx: number) {
    if (!dirHandle) {
      setConsoleLogs(prev => [...prev, "Error: No active vault folder open."])
      return
    }
    isChatCommandActiveRef.current = true
    try {
      if (action.type === 'COMPILE') {
        setConsoleLogs(prev => [...prev, `Starting agent-proposed compile...`])
        await compileVault(false, action.path || action.content)
      } else if (action.type === 'REINDEX') {
        setConsoleLogs(prev => [...prev, `Starting agent-proposed reindex...`])
        await reindexWiki()
      } else if (action.type === 'STATUS') {
        setConsoleLogs(prev => [...prev, `Starting agent-proposed status check...`])
        await checkStatus()
      } else if (action.type === 'LINT') {
        setConsoleLogs(prev => [...prev, `Starting agent-proposed lint...`])
        await runLint()
      } else if (action.type === 'RENAME') {
        const oldPath = action.path.trim()
        const newPath = action.content.trim()
        if (!oldPath || !newPath) {
          throw new Error("Rename action requires both old and new paths.")
        }
        await renameFile(oldPath, newPath)
        setConsoleLogs(prev => [...prev, `✓ Agent renamed file: ${oldPath} to ${newPath}`])
      } else {
        const parts = action.path.split('/')
        const fileName = parts.pop()!
        let currentDir = dirHandle
        for (const part of parts) {
          if (part.trim()) {
            currentDir = await currentDir.getDirectoryHandle(part.trim(), { create: true })
          }
        }

        if (action.type === 'DELETE') {
          await currentDir.removeEntry(fileName)
          await appendLogEntry(`[Agent Deleted] file: ${action.path}`)
          if (selectedFile?.path === action.path) {
            setSelectedFile(null)
            setEditorText('')
          }
          setConsoleLogs(prev => [...prev, `✓ Agent deleted file: ${action.path}`])
        } else {
          const fileHandle = await currentDir.getFileHandle(fileName, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(action.content)
          await writable.close()
          await appendLogEntry(`[Agent Written] file: ${action.path}`)
          setConsoleLogs(prev => [...prev, `✓ Agent wrote file: ${action.path}`])
        }
      }

      await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      setResolvedActions(prev => ({ ...prev, [msgIdx]: 'approved' }))
      setConsoleLogs(prev => [...prev, `✓ Successfully executed ${action.type.toLowerCase()} operation.`])
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `❌ Action execution error: ${err.message}`])
    } finally {
      isChatCommandActiveRef.current = false
    }
  }

  async function submitProposalComment(action: ProposedAction, uniqueKey: number) {
    const comment = proposalComments[uniqueKey]
    if (!comment || !comment.trim()) return

    setResolvedActions(prev => ({ ...prev, [uniqueKey]: 'dismissed' }))

    const feedbackMsg = `Regarding the proposal to ${action.type} for "${action.path}":\n\n"${comment.trim()}"\n\nCan you adjust this and generate a new proposal?`

    setProposalComments(prev => {
      const next = { ...prev }
      delete next[uniqueKey]
      return next
    })

    await sendChatMessage(feedbackMsg)
  }

  // 7a. Inline annotation helpers

  function handleMessageAreaPointerUp() {
    // Delay 50 ms so mobile has time to finalise the selection before we read it
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const text = sel.toString().trim()
      if (text.length < 2) return
      sel.removeAllRanges()           // clears selection → dismisses Android toolbar
      setCommentPopover({ quote: text })
      setCommentDraft('')
    }, 50)
  }

  function addPendingComment() {
    if (!commentDraft.trim() || !commentPopover) return
    setPendingComments(prev => [...prev, { quote: commentPopover.quote, note: commentDraft.trim() }])
    setCommentPopover(null)
    setCommentDraft('')
  }

  function removePendingComment(index: number) {
    setPendingComments(prev => prev.filter((_, i) => i !== index))
  }

  function copyMessage(idx: number, text: string) {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  function rewindToMessage(idx: number, role: 'user' | 'ai' | 'system', text: string) {
    if (role === 'user') {
      // Remove this message and everything after; restore text to input
      setChatMessages(prev => prev.slice(0, idx))
      setChatInput(text)
    } else {
      // Keep this AI message; remove everything after
      setChatMessages(prev => prev.slice(0, idx + 1))
    }
  }

  // 7. Socratic Chat with active page context
  async function sendChatMessage(messageOverride?: string) {
    const inputToUse = messageOverride || chatInput
    const hasAnnotations = !messageOverride && pendingComments.length > 0
    if ((!inputToUse.trim() && !hasAnnotations) || chatLoading) return
    const rawInput = inputToUse.trim()

    // Build the full message incorporating any pending inline annotations
    let userText = rawInput
    if (hasAnnotations) {
      const annotationsBlock = pendingComments.map(c => `• "${c.quote}" → ${c.note}`).join('\n')
      userText = `💬 Annotating your response:\n${annotationsBlock}${rawInput ? `\n\nOverall direction: ${rawInput}` : ''}`
      setPendingComments([])
    }
    
    // Check if this is a console command starting with #
    if (userText.startsWith('#')) {
      if (!messageOverride) {
        setChatInput('')
      }
      setChatMessages(prev => [...prev, { role: 'user', text: userText }])
      
      // Execute command in chat mode
      isChatCommandActiveRef.current = true
      try {
        await handleGardenCommand(userText)
      } catch (err: any) {
        setChatMessages(prev => [...prev, { role: 'system', text: `❌ Execution error: ${err.message}` }])
      } finally {
        isChatCommandActiveRef.current = false
      }
      return
    }

    if (!messageOverride) {
      setChatInput('')
    }
    setChatMessages(prev => [...prev, { role: 'user', text: userText }])
    setChatLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)

    try {
      let latestFiles = files
      if (dirHandle) {
        try {
          const scanned = await Promise.race([
            scanFolder(dirHandle),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('scan timeout')), 8000))
          ])
          latestFiles = scanned.filesList
          setFiles(scanned.filesList)
          setSubdirs(scanned.directoriesList)
        } catch (e) {
          console.error('Failed to pre-scan folder before chat:', e)
        }
      }

      // Binary file extensions that cannot be read as text
      const BINARY_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','ico','bmp','tiff','pdf','docx','doc','xlsx','xls','pptx','ppt','mp4','mp3','wav','mov','avi','zip','rar','7z'])
      const isBinary = (name: string) => BINARY_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '')
      // Strip characters that break JSON.stringify (null bytes, lone surrogates)
      const sanitize = (text: string) => text.replace(/\0/g, '').replace(/[\uD800-\uDFFF]/g, '')

      // 1. Gather all file paths and categories to create the directory overview
      const fileTreeText = latestFiles.map(f => `- ${f.path} (${f.name})`).join('\n')

      // 2. Load the contents of the main index maps and user profile
      const mapFiles = latestFiles.filter(f => 
        f.path === 'wai.md' || 
        f.name === 'index.md' || 
        f.name === 'log.md'
      )

      const mapContents = await Promise.all(
        mapFiles.map(async (file) => {
          try {
            const rawText = await Promise.race([
              file.handle.getFile().then((f) => f.text()),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('file read timeout')), 5000))
            ])
            return `--- START INDEX FILE: ${file.path} ---\n${sanitize(rawText)}\n--- END INDEX FILE: ${file.path} ---`
          } catch (err) {
            console.error(`Error loading index file ${file.path}:`, err)
            return `--- START INDEX FILE: ${file.path} ---\n[Error loading]\n--- END INDEX FILE: ${file.path} ---`
          }
        })
      )

      const indexContext = `=== VAULT FILE TREE ===\n${fileTreeText}\n\n=== INDEX & PROFILE MAPS ===\n${mapContents.join('\n\n')}`

      // 3. Query the Router API endpoint to identify relevant file paths
      let selectedPaths: string[] = []
      try {
        const routeRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'route',
            query: userText,
            indexContext: indexContext
          }),
          signal: controller.signal
        })
        if (routeRes.ok) {
          const routeData = await routeRes.json()
          selectedPaths = routeData.files || []
        }
      } catch (err) {
        console.error('Failed to run chat router:', err)
      }

      // Always force-include the user profile if it exists
      if (latestFiles.some(f => f.path === 'wai.md') && !selectedPaths.includes('wai.md')) {
        selectedPaths.push('wai.md')
      }

      // 4. Print retrieved context list as a system message in the chat history
      const loadedFileNames = latestFiles
        .filter(f => selectedPaths.includes(f.path) && f.path !== 'wai.md')
        .map(f => f.name)

      if (loadedFileNames.length > 0) {
        const sysMsg = `🔍 Loaded context from: ${loadedFileNames.join(', ')}`
        setChatMessages(prev => [...prev, { role: 'system', text: sysMsg }])
      }

      // 5. Load the full contents of ONLY the selected relevant files
      const filesToLoad = latestFiles.filter(f => selectedPaths.includes(f.path))
      const loadedFiles = await Promise.all(
        filesToLoad.map(async (file) => {
          try {
            if (isBinary(file.name)) {
              return `--- START FILE: ${file.path} ---\n[Binary file — skipped]\n--- END FILE: ${file.path} ---`
            }
            const rawText = (selectedFile && file.path === selectedFile.path)
              ? editorText
              : await Promise.race([
                  file.handle.getFile().then((f) => f.text()),
                  new Promise<never>((_, rej) => setTimeout(() => rej(new Error('file read timeout')), 5000))
                ])
            return `--- START FILE: ${file.path} ---\n${sanitize(rawText)}\n--- END FILE: ${file.path} ---`
          } catch (err) {
            console.error(`Error loading content for ${file.path}:`, err)
            return `--- START FILE: ${file.path} ---\n[Error loading content]\n--- END FILE: ${file.path} ---`
          }
        })
      )

      // 6. Fetch vault status metadata dynamically
      let statusText = ''
      try {
        const statusData = await Promise.race([
          getVaultStatusData(latestFiles),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('status timeout')), 5000))
        ])
        statusText = `=== VAULT COMPILE STATUS ===
Last Compile Time: ${statusData.lastCompileTime ? new Date(statusData.lastCompileTime).toISOString() : 'Never'}
Pending Compile Files (Uncompiled or Modified): ${JSON.stringify(statusData.pending)}
Up to Date Files: ${JSON.stringify(statusData.upToDate)}
============================\n\n`
      } catch (e) {
        console.error('Error fetching vault status data for chat context:', e)
      }

      const contextText = `${statusText}=== SELECTED CONTEXT DOCUMENTS ===\n\n${loadedFiles.join('\n\n')}`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', text: userText }],
          persona: 'literary-coach',
          context: contextText,
          gardenSubject
        }),
        signal: controller.signal,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection error')

      setChatMessages(prev => [...prev, { role: 'ai', text: data.reply }])
    } catch (err: any) {
      const msg = (err as Error).name === 'AbortError'
        ? 'Request timed out — check your connection and try again.'
        : `Connection error: ${(err as Error).message}. Your messages are not lost.`
      setChatMessages(prev => [...prev, { role: 'ai', text: msg }])
    } finally {
      clearTimeout(timeoutId)
      setChatLoading(false)
    }
  }

  async function exportChatLog() {
    if (chatMessages.length === 0) return
    
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`
    const fileDateStr = `${year}${month}${day}-${hours}${minutes}`
    
    const markdownContent = `---
title: "Chat Log: ${formattedDate}"
date: "${year}-${month}-${day}"
type: "chat-log"
---

# Chat Log: ${formattedDate}

${chatMessages.map(m => `### ${m.role === 'user' ? 'User' : 'Ember (AI)'}\n${m.text}`).join('\n\n')}
`

    const choice = window.confirm(
      "Do you want to save this directly in your vault's 'raw/chats' folder? \n\n(Click 'OK' to save in vault, or 'Cancel' to download/save elsewhere)"
    )

    if (choice) {
      if (!dirHandle) {
        alert("No active vault folder open.")
        return
      }
      try {
        let rawHandle = dirHandle
        if (rawFolderName && rawFolderName !== '.') {
          const parts = rawFolderName.split('/')
          for (const part of parts) {
            if (part.trim()) {
              rawHandle = await rawHandle.getDirectoryHandle(part, { create: true })
            }
          }
        }
        const chatsHandle = await rawHandle.getDirectoryHandle('chats', { create: true })
        const filename = `chat-log-${fileDateStr}.md`
        const fileHandle = await chatsHandle.getFileHandle(filename, { create: true })
        
        const writable = await fileHandle.createWritable()
        await writable.write(markdownContent)
        await writable.close()

        const verifyFile = await fileHandle.getFile()
        const verifyContent = await verifyFile.text()
        if (verifyContent !== markdownContent) {
          throw new Error("Verification failed: Content was not saved correctly.")
        }

        alert(`Successfully saved to vault at: ${rawFolderName === '.' ? '' : rawFolderName + '/'}chats/${filename}`)
        await loadFiles(dirHandle, rawFolderName, wikiFolderName)
      } catch (err: any) {
        alert(`Error saving chat log to vault: ${err.message}`)
      }
    } else {
      const filename = `chat-log-${fileDateStr}.md`
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Markdown Files',
              accept: { 'text/markdown': ['.md'] }
            }]
          })
          const writable = await fileHandle.createWritable()
          await writable.write(markdownContent)
          await writable.close()
          alert("File saved successfully.")
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            alert(`Error saving file: ${err.message}`)
          }
        }
      } else {
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    }
  }

  // 8. Client-side Graph Visualization parsing
  useEffect(() => {
    if (activeTab !== 'graph') { setGraphStatus('idle'); return }
    if (files.length === 0) { setGraphStatus('empty'); return }
    if (!graphRef.current) return

    setGraphStatus('loading')
    let networkObj: any = null
    let cancelled = false

    const runGraph = async () => {
      try {
      const nodesData: any[] = []
      const edgesData: any[] = []

      // 1. Gather and parse wiki files only (exclude raw files to avoid duplicate IDs)
      const wikiFiles = files.filter(f => {
        if (f.name === 'index.md' || f.name === 'log.md') return false
        if (!f.name.endsWith('.md')) return false
        // Only files that live inside the wiki folder
        if (wikiFolderName && wikiFolderName !== '.') {
          return f.path.startsWith(wikiFolderName + '/')
        }
        return true
      })

      // Dynamic palette — assigned in encounter order so any type vocab works
      const TYPE_PALETTE = [
        '#f6c177','#9ccfd8','#eb6f92','#c4a7e7',
        '#31748f','#ebbcba','#6bc5a5','#f0a050',
        '#c0ca50','#e08888','#7ec8e3','#d4a0d4',
      ]
      const typeColorMap: Record<string, string> = {}
      let typeColorIdx = 0

      // Clear stale refs before building fresh data
      graphNodeTypeRef.current = {}

      // Kick off the vis-network import in the background while we read files serially.
      // Serial reads are essential on mobile — concurrent File System Access handles
      // overwhelm the browser and all return errors, leaving the graph empty.
      const visNetworkPromise = import('vis-network')

      for (const file of wikiFiles) {
        if (cancelled) break
        try {
          const fileObj = await Promise.race([
            file.handle.getFile(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
          ])
          const content = await Promise.race([
            fileObj.text(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
          ])

          // Simple regex parses
          const typeMatch = content.match(/type:\s*["']?([^"'\n]+)["']?/)
          const titleMatch = content.match(/^#\s+(.+)$/m)

          const type = (typeMatch ? typeMatch[1].trim() : 'other').toLowerCase()
          const title = titleMatch ? titleMatch[1].trim() : file.name.replace('.md', '')
          const id = file.name.replace('.md', '').toLowerCase()

          // Assign a palette colour the first time this type is seen
          if (!typeColorMap[type]) {
            typeColorMap[type] = TYPE_PALETTE[typeColorIdx % TYPE_PALETTE.length]
            typeColorIdx++
          }
          const nodeColor = typeColorMap[type]
          const s = graphSettingsRef.current
          const baseSize = s.nodeSize
          const scaledSize = Math.max(baseSize, Math.min(baseSize + content.length / 200, baseSize * 2.2))

          nodesData.push({
            id,
            label: title,
            title: `${title}\nType: ${type}`,
            color: {
              background: nodeColor,
              border: 'rgba(255,255,255,0.15)',
              highlight: { background: '#ebbcba', border: '#ebbcba' }
            },
            font: { color: '#e8e4dc', size: 12, face: 'Inter, system-ui' },
            shape: 'dot',
            size: scaledSize,
          })

          // Track nodeId → type so the filter effect can toggle visibility
          graphNodeTypeRef.current[id] = type

          // Extract [[wiki-links]] supporting alphanumeric, hyphens, underscores, and spaces
          const linkRegex = /\[\[([a-zA-Z0-9\-_\s]+)\]\]/g
          let match
          while ((match = linkRegex.exec(content)) !== null) {
            const targetId = match[1].trim().toLowerCase()
            edgesData.push({
              from: id,
              to: targetId,
              color: {
                color: 'rgba(156, 207, 216, 0.45)', // Translucent Pine Teal
                highlight: '#f6c177',
                hover: '#ebbcba'
              },
              width: 1.5,
              arrows: { to: { enabled: true, scaleFactor: 0.5 } }
            })
          }
        } catch (err) {
          console.error('Error parsing wiki node:', err)
        }
      }

      // Expose the type→colour map to the legend in the settings panel
      if (!cancelled) setGraphTypeMap({ ...typeColorMap })

      // Add greyed-out placeholder nodes for referenced links that are not yet created
      const declaredNodes = new Set(nodesData.map(n => n.id))
      const referencedNodes = new Set<string>()
      for (const edge of edgesData) {
        if (!declaredNodes.has(edge.to)) {
          referencedNodes.add(edge.to)
        }
      }

      for (const refId of referencedNodes) {
        const title = refId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        nodesData.push({
          id: refId,
          label: title,
          title: `${title} (Uncreated page)`,
          color: {
            background: 'rgba(38, 38, 38, 0.8)',
            border: '#525252',
            highlight: { background: '#ebbcba', border: '#ebbcba' }
          },
          font: { color: '#737373', size: 11, face: 'Inter, system-ui' },
          shape: 'dot',
          size: 7
        })
      }

      // Deduplicate nodes by ID (safety net for vaults where raw & wiki share filenames)
      const seenNodeIds = new Set<string>()
      const uniqueNodes = nodesData.filter(n => {
        if (seenNodeIds.has(n.id)) return false
        seenNodeIds.add(n.id)
        return true
      })
      // Drop edges whose endpoints don't exist in the final node set
      const uniqueEdges = edgesData.filter(e => seenNodeIds.has(e.from) && seenNodeIds.has(e.to))

      // Store for the hiddenTypes filter effect (must happen before setData calls)
      graphAllNodesRef.current = uniqueNodes
      graphAllEdgesRef.current = uniqueEdges

      // Initialize Vis.js (module was pre-loading while files were being read)
      const { Network } = await visNetworkPromise

      const data = {
        nodes: uniqueNodes,
        edges: uniqueEdges
      }

      const sv = graphSettingsRef.current
      const options = {
        nodes: {
          size: sv.nodeSize,
          borderWidth: 2,
          shadow: {
            enabled: true,
            color: 'rgba(0, 0, 0, 0.4)',
            size: 4,
            x: 2,
            y: 2
          }
        },
        edges: {
          width: sv.edgeWidth,
          arrows: { to: { enabled: sv.showArrows, scaleFactor: 0.5 } },
          smooth: {
            enabled: true,
            type: 'continuous',
            roundness: 0.5
          }
        },
        physics: {
          stabilization: {
            enabled: true,
            iterations: uniqueNodes.length > 60 ? 80 : 120,
          },
          barnesHut: {
            gravitationalConstant: sv.repulsion,
            centralGravity: sv.centralGravity,
            springLength: sv.springLength,
            springConstant: 0.04,
            damping: 0.09
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 100,
          selectable: true,
          zoomView: true,
          dragView: true
        }
      }

      if (networkInstance.current) {
        networkInstance.current.destroy()
      }

      if (cancelled) return

      // If there are truly no nodes, show empty state instead of a blank canvas
      if (uniqueNodes.length === 0) {
        if (!cancelled) setGraphStatus('empty')
        return
      }

      networkObj = new Network(graphRef.current!, data, options)
      networkInstance.current = networkObj
      if (!cancelled) setGraphStatus('idle')

      // After physics settles, fit the whole graph into view.
      // Critical on mobile: the default viewport doesn't auto-zoom to spread-out nodes.
      networkObj.once('stabilizationIterationsDone', () => {
        if (!cancelled) networkObj.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } })
      })

      // Re-apply any type filters that were active before this (re-)render
      if (hiddenTypesRef.current.size > 0) {
        const visible = uniqueNodes.filter((n: any) => {
          const t = graphNodeTypeRef.current[n.id]
          return !t || !hiddenTypesRef.current.has(t)
        })
        const visIds = new Set(visible.map((n: any) => n.id))
        const visEdges = uniqueEdges.filter((e: any) => visIds.has(e.from) && visIds.has(e.to))
        networkObj.setData({ nodes: visible, edges: visEdges })
        networkObj.once('stabilizationIterationsDone', () => {
          if (!cancelled) networkObj.fit({ animation: false })
        })
      }

      // Node click -> open file in editor safely
      networkObj.on('click', (params: any) => {
        try {
          if (params.nodes && params.nodes.length > 0) {
            const clickedId = params.nodes[0]
            
            // Wrap in setTimeout to complete the vis-network click thread before React state changes tear down the canvas
            setTimeout(() => {
              setFiles(prevFiles => {
                const clickedFile = prevFiles.find(
                  f => f.path.toLowerCase() === `wiki/${clickedId}.md` || 
                       f.path.toLowerCase() === `${clickedId}.md` || 
                       f.name.replace(/\.md$/, '').toLowerCase() === clickedId
                )
                if (clickedFile) {
                  selectFile(clickedFile)
                  setActiveTab('vault')
                }
                return prevFiles
              })
            }, 60)
          }
        } catch (err) {
          console.error('Click navigation error:', err)
        }
      })
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setGraphError(msg)
          setGraphStatus('error')
        }
        console.error('Graph render error:', err)
      }
    }

    // Delay lets the browser finish laying out the container before
    // vis-network measures it — critical on mobile where layout is async
    const timer = setTimeout(runGraph, 60)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (networkObj) {
        try { networkObj.destroy() } catch (e) { console.warn('Silent network destroy:', e) }
        if (networkInstance.current === networkObj) networkInstance.current = null
      }
    }
  }, [activeTab, files, wikiFolderName, graphRetry])

  // Subdirectory filters based on custom folder configurations
  const rawFilesList = files.filter(f => {
    if (rawFolderName === '.') {
      return !f.path.startsWith(wikiFolderName + '/') && !f.path.includes('/')
    }
    return f.path.startsWith(rawFolderName + '/')
  })

  const wikiFilesList = files.filter(f => {
    if (wikiFolderName === '.') {
      return !f.path.startsWith(rawFolderName + '/') && !f.path.includes('/')
    }
    return f.path.startsWith(wikiFolderName + '/')
  })

  const otherFilesList = files.filter(f => {
    const isRaw = rawFolderName === '.'
      ? (!f.path.startsWith(wikiFolderName + '/') && !f.path.includes('/'))
      : f.path.startsWith(rawFolderName + '/')
    const isWiki = wikiFolderName === '.'
      ? (!f.path.startsWith(rawFolderName + '/') && !f.path.includes('/'))
      : f.path.startsWith(wikiFolderName + '/')
    return !isRaw && !isWiki && f.name !== 'index.md' && f.name !== 'log.md'
  })

  let metadataCard: React.ReactNode = null
  let parsedBody: string = ''
  if (selectedFile) {
    const { frontmatter, body } = parseMarkdown(editorText)
    parsedBody = body
    const displayTitle = frontmatter.title || selectedFile.name.replace('.md', '')
    const displayType = frontmatter.type || 'other'
    const displaySources: string[] = frontmatter.sources || []
    const displayLastUpdated = frontmatter.last_updated || frontmatter.date || ''
    const categoryStyle = getCategoryStyle(displayType)

    metadataCard = (
      <div className="p-5 rounded-2xl border mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg transition-all"
           style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-serif tracking-tight text-stone-100">
              {displayTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                  style={{ background: categoryStyle.bg, color: categoryStyle.text, border: `1px solid ${categoryStyle.text}33` }}>
              {categoryStyle.label}
            </span>
          </div>
          
          {displayLastUpdated && (
            <p className="text-[11px] font-mono opacity-80 animate-fade-in" style={{ color: 'var(--text-dim)' }}>
              Last updated: {displayLastUpdated}
            </p>
          )}
        </div>

        {displaySources.length > 0 && (
          <div className="flex flex-col gap-1.5 items-start md:items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Sources
            </span>
            <div className="flex flex-wrap gap-1.5">
              {displaySources.map((source, index) => (
                <button
                  key={index}
                  onClick={() => handleSourceClick(source)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all hover:brightness-125 border"
                  style={{
                    background: 'var(--surface2)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)'
                }}
              >
                📁 {source}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

  function renderSidebarContents() {
    const activeFilePath: string | undefined = selectedFile?.path
    return selectedFile ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* File header with back button */}
          <div className="flex items-center gap-2 pb-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-xs font-semibold cursor-pointer transition-colors flex-shrink-0 hover:brightness-125"
              style={{ color: 'var(--accent)' }}
            >
              ← Vault
            </button>
            <span className="text-[10px] font-mono truncate flex-1" style={{ color: 'var(--text-muted)' }}>
              {selectedFile.path}
            </span>
            <span className="text-[10px] flex-shrink-0" style={{ color: saveStatus === 'saving' ? 'var(--accent)' : saveStatus === 'error' ? '#f87171' : '#4ade80' }}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? '❌' : '✓'}
            </span>
          </div>
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setEditorMode('visual')}
              className="px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
              style={{ background: editorMode === 'visual' ? 'var(--accent)' : 'var(--surface)', color: editorMode === 'visual' ? '#0a0a0a' : 'var(--text-dim)' }}
            >
              <span>👁️</span> HTML View
            </button>
            <button
              onClick={() => setEditorMode('edit')}
              className="px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-l flex items-center gap-1"
              style={{ borderColor: 'var(--border)', background: editorMode === 'edit' ? 'var(--accent)' : 'var(--surface)', color: editorMode === 'edit' ? '#0a0a0a' : 'var(--text-dim)' }}
            >
              <span>✏️</span> Edit
            </button>
          </div>
          {/* Editor content */}
          {editorMode === 'edit' ? (
            <textarea
              value={editorText}
              onChange={e => setEditorText(e.target.value)}
              className="flex-1 min-h-0 p-4 rounded-xl border outline-none bg-transparent resize-none font-mono text-sm leading-relaxed focus:border-amber-500/30 transition-all overflow-y-auto"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', scrollbarWidth: 'thin' }}
            />
          ) : (
            <div
              className="flex-1 min-h-0 p-4 rounded-xl border overflow-y-auto text-left"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)', scrollbarWidth: 'thin' }}
            >
              {metadataCard}
              <div className="prose prose-invert max-w-none text-stone-200">
                {renderMarkdownBody(parsedBody)}
              </div>
            </div>
          )}
          {/* Compile log */}
          {compileLog.length > 0 && (
            <div className="flex-shrink-0 p-3 rounded-lg border text-xs font-mono max-h-[150px] overflow-y-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {compileLog.map((log, idx) => (
                <p key={idx} style={{ color: log.startsWith('❌') ? 'red' : log.startsWith('✓') ? 'green' : 'var(--text-dim)' }}>{log}</p>
              ))}
            </div>
          )}
        </div>
    ) : (
      <>
        {/* Vault info header */}
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="truncate">
            <p className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>ACTIVE VAULT</p>
            <h2 className="text-sm font-bold truncate" style={{ color: 'var(--accent)' }}>{folderName}</h2>
          </div>
          <button 
            onClick={selectFolder} 
            className="text-[10px] uppercase font-bold tracking-wider hover:underline cursor-pointer hover:text-amber-500 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Change
          </button>
        </div>

        {/* Vault Folder Configuration Settings */}
        <div className="p-4 rounded-xl border flex flex-col gap-3 text-xs shadow-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="font-bold uppercase tracking-wider text-[9px] flex items-center justify-between border-b pb-1.5 border-stone-850" style={{ color: 'var(--text-muted)' }}>
            <span>Folder Mapping</span>
            <span className="text-[8px]" style={{ color: 'var(--accent)' }}>Active Config</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[10px]" style={{ color: 'var(--text-dim)' }}>Subject/Domain:</label>
            <input
              type="text"
              value={gardenSubject}
              onChange={e => {
                const val = e.target.value
                setGardenSubject(val)
                saveGardenConfig(val, rawFolderName, wikiFolderName)
              }}
              className="bg-stone-900 border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-amber-500/30 transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[10px]" style={{ color: 'var(--text-dim)' }}>Raw Sources Folder:</label>
            <div className="flex gap-1.5">
              <select 
                value={rawFolderName} 
                onChange={e => {
                  const val = e.target.value
                  setRawFolderName(val)
                  saveGardenConfig(gardenSubject, val, wikiFolderName)
                }}
                className="flex-1 bg-stone-900 border rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-amber-500/30 transition-all" 
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <option value=".">Root Directory (.)</option>
                {subdirs.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const custom = prompt('Enter custom Raw folder path (e.g. "raw" or "my-sources"):', rawFolderName)
                  if (custom !== null) {
                    const val = custom.trim() || '.'
                    setRawFolderName(val)
                    saveGardenConfig(gardenSubject, val, wikiFolderName)
                  }
                }}
                className="px-2 border rounded-lg hover:bg-stone-850 text-xs cursor-pointer hover:border-amber-500/30 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                title="Enter custom path"
              >
                ✏️
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-[10px]" style={{ color: 'var(--text-dim)' }}>Wiki Concepts Folder:</label>
            <div className="flex gap-1.5">
              <select 
                value={wikiFolderName} 
                onChange={e => {
                  const val = e.target.value
                  setWikiFolderName(val)
                  saveGardenConfig(gardenSubject, rawFolderName, val)
                }}
                className="flex-1 bg-stone-900 border rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-amber-500/30 transition-all" 
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <option value=".">Root Directory (.)</option>
                {subdirs.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const custom = prompt('Enter custom Wiki folder path (e.g. "wiki" or "my-wiki"):', wikiFolderName)
                  if (custom !== null) {
                    const val = custom.trim() || '.'
                    setWikiFolderName(val)
                    saveGardenConfig(gardenSubject, rawFolderName, val)
                  }
                }}
                className="px-2 border rounded-lg hover:bg-stone-850 text-xs cursor-pointer hover:border-amber-500/30 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                title="Enter custom path"
              >
                ✏️
              </button>
            </div>
          </div>
        </div>

        {/* Ingestion & Action */}
        <div className="relative">
          <button 
            onClick={() => setShowNewRawMenu(!showNewRawMenu)}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-center hover:opacity-90 cursor-pointer border transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'var(--surface2)', color: 'var(--accent)', borderColor: 'var(--border)' }}
          >
            <span>➕</span> New Raw File
          </button>
          {showNewRawMenu && (
            <>
              <div 
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowNewRawMenu(false)}
              />
              <div 
                className="absolute z-50 left-0 mt-1.5 w-full rounded-xl border p-1 shadow-2xl flex flex-col gap-0.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)' }}
              >
                <button
                  onClick={() => {
                    setShowNewRawMenu(false)
                    createRawFile()
                  }}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2.5 hover:bg-[#1a1a1a]"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }}
                >
                  <span className="text-[14px]">📝</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>Create instantly on web</span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Write template via web prompt</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowNewRawMenu(false)
                    insertFromLocalDisk()
                  }}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2.5 hover:bg-[#1a1a1a]"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }}
                >
                  <span className="text-[14px]">📥</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>Insert from local disk</span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Import existing text/md files</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowNewRawMenu(false)
                    importDocxFile()
                  }}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2.5 hover:bg-[#1a1a1a]"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }}
                >
                  <span className="text-[14px]">📂</span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs" style={{ color: 'var(--text)' }}>Import Word Doc (.docx)</span>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Convert text & extract images</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>



        {/* Folder Explorer view */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {/* Vault Documents (Root / Other folders) */}
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--text-muted)' }}>vault documents</p>
            {otherFilesList.length === 0 ? (
              <p className="text-xs italic p-1" style={{ color: 'var(--text-muted)' }}>No vault files</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {otherFilesList.map(f => (
                  <div 
                    key={f.path}
                    className={`group flex items-center justify-between rounded-lg hover:bg-stone-900/20 transition-all ${
                      activeFilePath === f.path ? 'bg-stone-900/60 font-bold' : ''
                    }`}
                  >
                    <button
                      onClick={() => selectFile(f)}
                      className="flex-1 text-left text-xs p-1.5 truncate cursor-pointer transition-all"
                      style={{
                        color: activeFilePath === f.path ? 'var(--accent)' : 'var(--text-dim)',
                      }}
                    >
                      {f.path === 'wai.md' ? '👤' : '📄'} {f.path}
                    </button>
                    {f.name !== 'index.md' && f.name !== 'log.md' && f.path !== 'wai.md' && f.name !== '.garden-config.json' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFile(f)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[11px] hover:text-rose-400 cursor-pointer transition-opacity"
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Folder */}
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--text-muted)' }}>raw source documents</p>
            {rawFilesList.length === 0 ? (
              <p className="text-xs italic p-1" style={{ color: 'var(--text-muted)' }}>No source files</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {rawFilesList.map(f => (
                  <div 
                    key={f.path}
                    className={`group flex items-center justify-between rounded-lg hover:bg-stone-900/20 transition-all ${
                      activeFilePath === f.path ? 'bg-stone-900/60 font-bold' : ''
                    }`}
                  >
                    <button
                      onClick={() => selectFile(f)}
                      className="flex-1 text-left text-xs p-1.5 truncate cursor-pointer transition-all"
                      style={{
                        color: activeFilePath === f.path ? 'var(--accent)' : 'var(--text-dim)',
                      }}
                    >
                      📄 {f.name}
                    </button>
                    {f.name !== 'index.md' && f.name !== 'log.md' && f.name !== '.garden-config.json' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFile(f)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[11px] hover:text-rose-400 cursor-pointer transition-opacity"
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wiki Folder */}
          <div>
            <p className="text-[10px] font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--text-muted)' }}>concept wiki pages</p>
            {wikiFilesList.length === 0 ? (
              <p className="text-xs italic p-1" style={{ color: 'var(--text-muted)' }}>No wiki files</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {wikiFilesList.map(f => (
                  <div 
                    key={f.path}
                    className={`group flex items-center justify-between rounded-lg hover:bg-stone-900/20 transition-all ${
                      activeFilePath === f.path ? 'bg-stone-900/60 font-bold' : ''
                    }`}
                  >
                    <button
                      onClick={() => selectFile(f)}
                      className="flex-1 text-left text-xs p-1.5 truncate cursor-pointer transition-all"
                      style={{
                        color: activeFilePath === f.path ? 'var(--accent)' : 'var(--text-dim)',
                      }}
                    >
                      🧠 {f.name}
                    </button>
                    {f.name !== 'index.md' && f.name !== 'log.md' && f.name !== '.garden-config.json' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFile(f)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-[11px] hover:text-rose-400 cursor-pointer transition-opacity"
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ color: 'var(--text)' }}>
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 border-b w-full" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="px-6 flex items-center justify-between h-14 w-full">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-bold tracking-widest hover:brightness-110 transition-all"
              style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif', letterSpacing: '0.2em' }}
            >
              W.A.I.
            </Link>
            <span className="text-stone-700 text-sm font-light">/</span>
            <span className="text-sm font-bold text-stone-200" style={{ fontFamily: 'Georgia, serif' }}>
              {dirHandle ? gardenSubject : 'Mind Sailing'}
            </span>
            {dirHandle && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:inline-flex items-center justify-center px-2.5 py-1 rounded border text-[10px] font-semibold tracking-wider hover:brightness-110 cursor-pointer transition-all ml-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                {isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
              </button>
            )}
          </div>
        </div>
      </header>

      {!dirHandle ? (
        // --- 1. Empty landing state ---
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 max-w-lg mx-auto text-center gap-6">
          <div className="text-6xl mb-2" style={{ color: 'var(--accent)', opacity: 0.6 }}>🧠</div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Mind Sailing
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            An interactive canvas to map, link, and explore the constellation of your insights. Open a local folder to anchor your daily thoughts, discover hidden connections, and sail through your personal web of knowledge.
          </p>
          
          <div className="flex flex-col gap-3 w-full mt-4">
            <button
              onClick={selectFolder}
              className="py-3 px-6 rounded-xl font-semibold text-sm transition-all hover:brightness-110 cursor-pointer"
              style={{ background: 'var(--accent)', color: '#0a0a0a' }}
            >
              Open Existing Vault Folder
            </button>
            <button
              onClick={initNewVault}
              className="py-3 px-6 rounded-xl font-semibold text-sm transition-all hover:brightness-110 border cursor-pointer"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              Initialize New Empty Vault
            </button>
          </div>
        </div>
      ) : (
        // --- 2. Main interface ---
        <div className="flex-1 min-h-0 overflow-hidden p-6 flex flex-col">
          <div className="grid grid-cols-12 grid-rows-1 gap-6 flex-1 min-h-0">
            {/* LEFT PANEL: File Explorer */}
            <div className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:flex lg:col-span-3 lg:flex-col lg:gap-4 lg:border-r lg:pr-4 lg:min-h-0'}`} style={{ borderColor: 'var(--border)' }}>
              {renderSidebarContents()}
            </div>

            {/* CENTER PANEL: Tabs (Editor, Chat, Graph) */}
            <div className={`col-span-12 ${isSidebarCollapsed ? '' : 'lg:col-span-9'} flex flex-col gap-4 overflow-hidden min-h-0`}>
              {/* Tab Selectors */}
              <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                {([
                  'vault',
                  'chat',
                  'graph'
                ] as TabType[]).map(tab => {
                  const isVaultTab = tab === 'vault'
                  const visibilityClass = isVaultTab 
                    ? (isSidebarCollapsed ? 'flex' : 'flex lg:hidden')
                    : 'flex'
                    
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`${visibilityClass} px-6 py-2 text-sm font-semibold border-b-2 transition-all capitalize cursor-pointer`}
                      style={{
                        borderColor: activeTab === tab ? 'var(--accent)' : 'transparent',
                        color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {tab === 'vault' ? 'Vault' : tab}
                    </button>
                  )
                })}
              </div>

              {/* TAB CONTENTS */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 0. VAULT TAB (Visible on mobile or when collapsed) */}
                {activeTab === 'vault' && (
                  <div className="flex-1 flex flex-col gap-4 animate-fade-in min-h-0">
                    {renderSidebarContents()}
                  </div>
                )}

                {/* 1. EDITOR TAB */}
                {activeTab === 'editor' && (
                  <div className="flex-1 flex flex-col gap-3">
                    {selectedFile ? (
                      <div className="flex-1 flex flex-col gap-2 animate-fade-in">
                        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex flex-col">
                            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-dim)' }}>
                              File: <span className="font-mono text-xs">{selectedFile.path}</span>
                            </h3>
                            <span className="text-[10px]" style={{ color: saveStatus === 'saving' ? 'var(--accent)' : 'var(--text-muted)' }}>
                              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? '❌ Save Error' : '✓ Saved'}
                            </span>
                          </div>
                          {/* Toggle Button Group */}
                          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                            <button
                              onClick={() => setEditorMode('edit')}
                              className="px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                              style={{
                                background: editorMode === 'edit' ? 'var(--accent)' : 'var(--surface)',
                                color: editorMode === 'edit' ? '#0a0a0a' : 'var(--text-dim)',
                              }}
                            >
                              <span>✏️</span> Edit
                            </button>
                            <button
                              onClick={() => setEditorMode('visual')}
                              className="px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border-l flex items-center gap-1"
                              style={{
                                borderColor: 'var(--border)',
                                background: editorMode === 'visual' ? 'var(--accent)' : 'var(--surface)',
                                color: editorMode === 'visual' ? '#0a0a0a' : 'var(--text-dim)',
                              }}
                            >
                              <span>👁️</span> Visual View
                            </button>
                          </div>
                        </div>

                        {editorMode === 'edit' ? (
                          <textarea
                            value={editorText}
                            onChange={e => setEditorText(e.target.value)}
                            className="flex-1 min-h-[450px] p-4 rounded-xl border outline-none bg-transparent resize-none font-mono text-sm leading-relaxed focus:border-amber-500/30 transition-all"
                            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                        ) : (
                          <div
                            className="flex-1 min-h-[450px] p-6 rounded-xl border bg-stone-950/25 overflow-y-auto max-h-[65vh] text-left"
                            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                          >
                            {metadataCard}
                            <div className="prose prose-invert max-w-none text-stone-200">
                              {renderMarkdownBody(parsedBody)}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border border-dashed rounded-xl" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Select a file from the explorer to view or edit.
                        </p>
                      </div>
                    )}

                    {/* Compile output log if compiling */}
                    {compileLog.length > 0 && (
                      <div className="p-3 rounded-lg border text-xs font-mono max-h-[150px] overflow-y-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        {compileLog.map((log, idx) => (
                          <p key={idx} style={{ color: log.startsWith('❌') ? 'red' : log.startsWith('✓') ? 'green' : 'var(--text-dim)' }}>
                            {log}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SOCRATIC CHAT TAB */}
                {activeTab === 'chat' && (
                  <div className="flex-1 flex flex-col gap-4 border rounded-xl p-4 overflow-hidden min-h-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    {chatMessages.length > 0 && (
                      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Chat History</span>
                        <button
                          onClick={exportChatLog}
                          className="px-2.5 py-1 rounded bg-stone-900 border border-stone-800 hover:border-amber-500/30 hover:bg-stone-850 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          style={{ color: 'var(--accent)' }}
                        >
                          📥 Export Chat Log
                        </button>
                      </div>
                    )}
                    <div
                      ref={chatScrollContainerRef}
                      onScroll={(e) => {
                        const el = e.currentTarget
                        userScrolledUpRef.current = el.scrollTop < el.scrollHeight - el.clientHeight - 50
                      }}
                      onPointerUp={handleMessageAreaPointerUp}
                      className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 min-h-0"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {chatMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                          <div className="text-4xl mb-2" style={{ color: 'var(--accent)', opacity: 0.3 }}>✦</div>
                          <p className="text-sm font-semibold text-stone-200 mb-1">
                            Talk to Ember
                          </p>
                          <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            Ember is your Socratic coach. Ask her questions to explore your digital garden and second brain together.<br/>
                            {selectedFile && `Currently loaded context: ${selectedFile.name}`}
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((m, idx) => {
                          const isAI = m.role === 'ai'
                          let displayNode = <>{m.text}</>
                          let actionsList: ProposedAction[] = []
                          let cleanText = m.text

                          if (isAI) {
                            const parsed = parseMessageActions(m.text)
                            cleanText = parsed.cleanText
                            displayNode = <>{cleanText}</>
                            actionsList = parsed.actions
                          }

                          if (m.role === 'system') {
                            let systemColor = 'text-stone-400 border-l-2 border-stone-700'
                            if (m.text.includes('✓') || m.text.includes('success') || m.text.includes('completed') || m.text.includes('complete')) {
                              systemColor = 'text-emerald-400 border-l-2 border-emerald-500/50'
                            } else if (m.text.includes('❌') || m.text.includes('Error') || m.text.includes('failed')) {
                              systemColor = 'text-rose-400 border-l-2 border-rose-500/50'
                            } else if (m.text.startsWith('> ') || m.text.startsWith('Starting') || m.text.includes('Scanning') || m.text.includes('Scanning...')) {
                              systemColor = 'text-amber-400/90 border-l-2 border-amber-500/50 font-semibold'
                            }
                            return (
                              <div key={idx} className={`w-full max-w-[90%] my-0.5 rounded-r-md px-3 py-1 font-mono text-[10px] bg-stone-950/20 ${systemColor} animate-fade-in`}>
                                {m.text}
                              </div>
                            )
                          }

                          return (
                            <div key={idx} className="flex flex-col gap-2 max-w-[85%]" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                              <div className={`rounded-xl p-3 text-sm leading-relaxed ${m.role === 'user' ? 'border' : 'border'}`}
                                style={{
                                  background: m.role === 'user' ? 'var(--accent)' : 'transparent',
                                  color: m.role === 'user' ? '#0a0a0a' : 'var(--text-dim)',
                                  borderColor: m.role === 'user' ? 'transparent' : 'var(--border)',
                                  whiteSpace: m.role === 'user' ? 'pre-wrap' : undefined,
                                }}
                              >
                                {displayNode}
                              </div>

                              {/* Per-message controls: copy · rewind · annotate */}
                              <div className={`flex items-center gap-0.5 -mt-1 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <button
                                  onClick={() => copyMessage(idx, cleanText)}
                                  className="flex items-center justify-center w-6 h-6 rounded text-[11px] border border-transparent hover:border-stone-800 cursor-pointer transition-all hover:text-amber-400"
                                  style={{ color: copiedIdx === idx ? 'var(--accent)' : 'var(--text-muted)' }}
                                  title="Copy"
                                >
                                  {copiedIdx === idx ? '✓' : '⎘'}
                                </button>
                                <button
                                  onClick={() => rewindToMessage(idx, m.role, m.text)}
                                  className="flex items-center justify-center w-6 h-6 rounded text-[11px] border border-transparent hover:border-stone-800 cursor-pointer transition-all hover:text-rose-400"
                                  style={{ color: 'var(--text-muted)' }}
                                  title={m.role === 'user' ? 'Edit & resend' : 'Rewind to here'}
                                >
                                  ↩
                                </button>
                                {isAI && (
                                  <button
                                    onClick={() => {
                                      const sel = window.getSelection()
                                      const quote = (sel && !sel.isCollapsed) ? sel.toString().trim() : ''
                                      sel?.removeAllRanges()
                                      setCommentPopover({ quote })
                                      setCommentDraft('')
                                    }}
                                    className="flex items-center justify-center w-6 h-6 rounded text-[11px] border border-transparent hover:border-stone-800 cursor-pointer transition-all hover:text-amber-400"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="Annotate"
                                  >
                                    💬
                                  </button>
                                )}
                              </div>

                              {actionsList.length > 0 && actionsList.map((action, actionIdx) => {
                                const uniqueKey = idx * 1000 + actionIdx
                                const resolution = resolvedActions[uniqueKey]
                                const isApproved = resolution === 'approved'
                                const isDismissed = resolution === 'dismissed'

                                return (
                                  <div 
                                    key={actionIdx} 
                                    className="rounded-xl border p-3 flex flex-col gap-2 bg-stone-950/40 border-amber-500/20 text-xs shadow-md max-w-sm animate-fade-in"
                                  >
                                    <div className="flex items-center justify-between border-b pb-1.5 border-stone-800">
                                      <span className="font-bold text-amber-500 flex items-center gap-1">
                                        ✨ Proposal: {action.type}
                                      </span>
                                      <span className="font-mono text-[9px] text-stone-500">{action.path}</span>
                                    </div>
                                    
                                    {action.type === 'COMPILE' && (
                                      <div className="text-[11px] text-stone-300">
                                        Compile raw files into the wiki. {action.path && <span className="block font-semibold mt-1">Focus: {action.path}</span>}
                                      </div>
                                    )}

                                    {action.type === 'REINDEX' && (
                                      <div className="text-[11px] text-stone-300">
                                        Regenerate table of contents (`index.md` & `log.md`).
                                      </div>
                                    )}

                                    {action.type === 'STATUS' && (
                                      <div className="text-[11px] text-stone-300">
                                        Check for new/modified raw files since last compile.
                                      </div>
                                    )}

                                    {action.type === 'LINT' && (
                                      <div className="text-[11px] text-stone-300">
                                        Audit vault for format, orphan files, and broken links.
                                      </div>
                                    )}

                                    {action.type === 'RENAME' && (
                                      <div className="text-[11px] text-stone-300">
                                        Rename <code className="font-mono text-stone-400">{action.path}</code> to <code className="font-mono text-amber-400">{action.content.trim()}</code>.
                                      </div>
                                    )}

                                    {action.type === 'DELETE' && (
                                      <div className="text-[11px] text-rose-400 font-semibold">
                                        Warning: This will delete "{action.path}" from your vault.
                                      </div>
                                    )}

                                    {(action.type === 'CREATE' || action.type === 'WRITE') && (
                                      <div className="font-mono text-[10px] bg-black/45 p-2 rounded text-stone-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                                        {action.content}
                                      </div>
                                    )}

                                    {resolution ? (
                                      <div className={`text-[10px] font-bold mt-1 text-center py-1 rounded ${isApproved ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-stone-900/40 text-stone-500'}`}>
                                        {isApproved ? '✓ Executed' : '✗ Declined'}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2 mt-1">
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => {
                                              setResolvedActions(prev => ({ ...prev, [uniqueKey]: 'approved' }))
                                              executeAgentAction(action, uniqueKey)
                                            }}
                                            className="flex-1 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-semibold text-[11px] cursor-pointer transition-all"
                                          >
                                            Approve & Execute
                                          </button>
                                          <button
                                            onClick={() => setResolvedActions(prev => ({ ...prev, [uniqueKey]: 'dismissed' }))}
                                            className="py-1 px-2.5 rounded bg-stone-900 hover:bg-stone-850 border border-stone-800 text-[11px] text-stone-400 cursor-pointer transition-all"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                        <div className="flex flex-col gap-1 border-t pt-2 border-stone-850">
                                          <textarea
                                            placeholder="Suggest adjustments to this proposal..."
                                            className="w-full bg-stone-900 border rounded-lg p-1.5 text-[10px] outline-none resize-none focus:border-amber-500/30 transition-all text-stone-200"
                                            rows={2}
                                            value={proposalComments[uniqueKey] || ''}
                                            onChange={(e) => setProposalComments(prev => ({ ...prev, [uniqueKey]: e.target.value }))}
                                          />
                                          <button
                                            onClick={() => submitProposalComment(action, uniqueKey)}
                                            disabled={!proposalComments[uniqueKey]?.trim()}
                                            className="py-1 rounded bg-stone-850 border border-stone-800 hover:border-amber-500/30 hover:bg-stone-800 text-stone-300 hover:text-amber-500 font-semibold text-[9px] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                            💬 Send Feedback
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })
                      )}
                      {chatLoading && (
                        <div className="self-start text-[10px] animate-pulse" style={{ color: 'var(--text-muted)' }}>
                          thinking…
                        </div>
                      )}
                      <div ref={chatMessagesEndRef} />
                    </div>


                    {/* Comment popover modal */}
                    {commentPopover && (
                      <div
                        className="fixed inset-0 z-[9999] flex items-end justify-center pb-24"
                        style={{ background: 'rgba(0,0,0,0.35)' }}
                        onMouseDown={() => { setCommentPopover(null); setCommentDraft('') }}
                      >
                        <div
                          className="rounded-2xl border p-4 shadow-2xl flex flex-col gap-3 w-80 animate-fade-in"
                          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Annotate Ember's response
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Specific passage (optional — paste or select text first)</label>
                            <input
                              value={commentPopover.quote}
                              onChange={e => setCommentPopover(prev => prev ? { ...prev, quote: e.target.value } : null)}
                              placeholder="The part of her response you're reacting to…"
                              className="w-full rounded-lg px-2.5 py-1.5 text-[10px] font-mono border outline-none placeholder:text-stone-600"
                              style={{ background: 'var(--surface2)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-dim)' }}
                            />
                          </div>
                          <textarea
                            autoFocus
                            value={commentDraft}
                            onChange={e => setCommentDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addPendingComment() }}
                            placeholder="Your note or feedback… (⌘↵ to add)"
                            rows={3}
                            className="w-full rounded-lg p-2.5 text-xs resize-none outline-none placeholder:text-stone-600 border"
                            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setCommentPopover(null); setCommentDraft('') }}
                              className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-all hover:border-stone-700"
                              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={addPendingComment}
                              disabled={!commentDraft.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 transition-all hover:brightness-110"
                              style={{ background: 'var(--accent)', color: '#0a0a0a' }}
                            >
                              Add Note
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="relative border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      {/* Autocomplete Dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-lg border border-amber-500/20 bg-stone-950/95 p-1 shadow-2xl flex flex-col gap-0.5 animate-fade-in">
                          {suggestions.map((s, idx) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => selectSuggestion(s)}
                              className={`w-full text-left text-[11px] px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                                idx === activeSuggestionIdx ? 'bg-amber-500/10 text-amber-400 font-bold border-l-2 border-amber-500' : 'text-stone-400 hover:bg-stone-900'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Pending annotation chips */}
                      {pendingComments.length > 0 && (
                        <div className="flex flex-col gap-1 mb-2">
                          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)', opacity: 0.6 }}>
                            Annotations to send ({pendingComments.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {pendingComments.map((c, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border max-w-full"
                                style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)', color: 'var(--text-dim)' }}
                              >
                                <span className="shrink-0">💬</span>
                                <span className="italic text-stone-500 shrink-0 max-w-[70px] truncate">"{c.quote.length > 18 ? c.quote.slice(0, 18) + '…' : c.quote}"</span>
                                <span className="shrink-0" style={{ color: 'var(--accent)', opacity: 0.5 }}>→</span>
                                <span className="text-stone-300 truncate max-w-[90px]">{c.note}</span>
                                <button
                                  onClick={() => removePendingComment(i)}
                                  className="ml-0.5 shrink-0 hover:text-rose-400 transition-colors cursor-pointer leading-none"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={handleChatInputChange}
                          onKeyDown={handleChatKeyDown}
                          placeholder="Ask Ember, your Socratic coach... (use # for commands)"
                          className="flex-1 outline-none bg-transparent text-sm"
                          style={{ color: 'var(--text)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowHelpModal(true)}
                          className="px-2.5 py-2 rounded-lg bg-stone-900 border border-stone-850 hover:border-amber-500/30 hover:bg-stone-850 text-xs cursor-pointer flex items-center justify-center transition-all"
                          title="Command Help"
                        >
                          <span>📖</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => sendChatMessage()}
                          disabled={(!chatInput.trim() && pendingComments.length === 0) || chatLoading}
                          className="px-4 py-2 rounded-lg text-xs font-semibold hover:brightness-110 disabled:opacity-40 cursor-pointer"
                          style={{ background: 'var(--accent)', color: '#0a0a0a' }}
                        >
                          Send
                        </button>
                      </div>
                      
                      <div className="text-[10px] text-center mt-2.5 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <span>⚡ Powered by DeepSeek API</span>
                        <span style={{ opacity: 0.3 }}>|</span>
                        <span>🔒 Private local-data processing via Google Vertex AI coming soon</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. GRAPH TAB */}
                {activeTab === 'graph' && (
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    {/* Header row */}
                    <div className="flex items-center justify-between pb-2">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        INTERACTIVE KNOWLEDGE GRAPH
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Tap node to open.
                        </span>
                        <button
                          onClick={() => setShowGraphSettings(v => !v)}
                          title="Graph settings"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border cursor-pointer transition-all hover:brightness-110"
                          style={{
                            background: showGraphSettings ? 'var(--accent)' : 'var(--surface2)',
                            borderColor: showGraphSettings ? 'var(--accent)' : 'var(--border)',
                            color: showGraphSettings ? '#0a0a0a' : 'var(--text-dim)',
                          }}
                        >
                          ⚙ Settings
                        </button>
                      </div>
                    </div>

                    {/* Graph container */}
                    <div className="flex-1 min-h-[350px] relative rounded-xl border overflow-hidden"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    >
                      {/* vis-network draws into this absolutely-positioned div */}
                      <div ref={graphRef} className="absolute inset-0" />

                      {/* Status overlays */}
                      {graphStatus === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>Building graph…</span>
                        </div>
                      )}
                      {graphStatus === 'empty' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                          <div className="text-3xl" style={{ color: 'var(--accent)', opacity: 0.25 }}>✦</div>
                          <p className="text-sm text-stone-400">No wiki files found</p>
                          <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            Open your vault and compile your raw notes first — the graph will appear here once wiki pages exist.
                          </p>
                        </div>
                      )}
                      {graphStatus === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
                          <p className="text-xs text-rose-400 font-semibold">Graph failed to render</p>
                          {graphError && (
                            <p className="text-[10px] font-mono text-stone-500 max-w-xs break-words">{graphError}</p>
                          )}
                          <button
                            onClick={() => { setGraphStatus('loading'); setGraphError(''); setGraphRetry(n => n + 1) }}
                            className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-all hover:brightness-110"
                            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                          >
                            ↺ Retry
                          </button>
                        </div>
                      )}

                      {/* Settings panel — slides in from right */}
                      {showGraphSettings && (
                        <div
                          className="absolute top-0 right-0 bottom-0 z-20 flex flex-col overflow-y-auto"
                          style={{
                            width: '220px',
                            background: 'rgba(14,12,10,0.93)',
                            borderLeft: '1px solid var(--border)',
                            backdropFilter: 'blur(8px)',
                          }}
                        >
                          {/* Panel header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>Graph Settings</span>
                            <button
                              onClick={() => setShowGraphSettings(false)}
                              className="text-stone-500 hover:text-stone-300 transition-colors text-xs cursor-pointer"
                            >✕</button>
                          </div>

                          <div className="flex flex-col gap-4 px-3 py-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>

                            {/* Node size */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>Node size</span>
                                <span style={{ color: 'var(--accent)' }}>{graphSettings.nodeSize}</span>
                              </div>
                              <input type="range" min={6} max={30} step={1}
                                value={graphSettings.nodeSize}
                                onChange={e => setGraphSettings(s => ({ ...s, nodeSize: Number(e.target.value) }))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>

                            {/* Edge width */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>Edge width</span>
                                <span style={{ color: 'var(--accent)' }}>{graphSettings.edgeWidth.toFixed(1)}</span>
                              </div>
                              <input type="range" min={0.5} max={5} step={0.5}
                                value={graphSettings.edgeWidth}
                                onChange={e => setGraphSettings(s => ({ ...s, edgeWidth: Number(e.target.value) }))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>

                            {/* Repulsion */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>Repulsion</span>
                                <span style={{ color: 'var(--accent)' }}>{graphSettings.repulsion}</span>
                              </div>
                              <input type="range" min={-20000} max={-500} step={500}
                                value={graphSettings.repulsion}
                                onChange={e => setGraphSettings(s => ({ ...s, repulsion: Number(e.target.value) }))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>

                            {/* Central gravity */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>Central gravity</span>
                                <span style={{ color: 'var(--accent)' }}>{graphSettings.centralGravity.toFixed(2)}</span>
                              </div>
                              <input type="range" min={0.01} max={0.5} step={0.01}
                                value={graphSettings.centralGravity}
                                onChange={e => setGraphSettings(s => ({ ...s, centralGravity: Number(e.target.value) }))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>

                            {/* Spring length */}
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                <span>Spring length</span>
                                <span style={{ color: 'var(--accent)' }}>{graphSettings.springLength}</span>
                              </div>
                              <input type="range" min={60} max={500} step={10}
                                value={graphSettings.springLength}
                                onChange={e => setGraphSettings(s => ({ ...s, springLength: Number(e.target.value) }))}
                                className="w-full accent-amber-400 cursor-pointer"
                              />
                            </div>

                            {/* Show arrows toggle */}
                            <div className="flex items-center justify-between">
                              <span>Show arrows</span>
                              <button
                                onClick={() => setGraphSettings(s => ({ ...s, showArrows: !s.showArrows }))}
                                className="w-8 h-4 rounded-full border transition-all cursor-pointer relative"
                                style={{
                                  background: graphSettings.showArrows ? 'var(--accent)' : 'var(--surface2)',
                                  borderColor: graphSettings.showArrows ? 'var(--accent)' : 'var(--border)',
                                }}
                              >
                                <span
                                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                                  style={{ left: graphSettings.showArrows ? '17px' : '1px' }}
                                />
                              </button>
                            </div>

                            {/* Re-layout button */}
                            <button
                              onClick={() => { setGraphStatus('loading'); setGraphRetry(n => n + 1) }}
                              className="mt-1 w-full py-1.5 rounded-lg border text-[10px] cursor-pointer transition-all hover:brightness-110"
                              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                            >
                              ↺ Re-layout graph
                            </button>

                            {/* Type legend — tap to show/hide that type */}
                            {Object.keys(graphTypeMap).length > 0 && (
                              <div className="flex flex-col gap-1 border-t pt-3 mt-1" style={{ borderColor: 'var(--border)' }}>
                                <span className="font-semibold mb-0.5" style={{ color: 'var(--text-dim)' }}>
                                  Node types <span className="font-normal text-stone-600">(tap to toggle)</span>
                                </span>
                                {Object.entries(graphTypeMap).map(([type, color]) => {
                                  const isHidden = hiddenTypes.has(type)
                                  return (
                                    <button
                                      key={type}
                                      onClick={() => setHiddenTypes(prev => {
                                        const next = new Set(prev)
                                        if (next.has(type)) next.delete(type)
                                        else next.add(type)
                                        return next
                                      })}
                                      className="flex items-center gap-2 w-full text-left cursor-pointer rounded px-1 py-0.5 transition-opacity hover:bg-white/5"
                                      style={{ opacity: isHidden ? 0.35 : 1 }}
                                      title={isHidden ? `Show ${type}` : `Hide ${type}`}
                                    >
                                      <span
                                        className="inline-block w-3 h-3 rounded-full flex-shrink-0 transition-all"
                                        style={{
                                          background: isHidden ? '#444' : color,
                                          boxShadow: isHidden ? 'none' : `0 0 5px ${color}66`,
                                        }}
                                      />
                                      <span
                                        className="capitalize truncate"
                                        style={{ textDecoration: isHidden ? 'line-through' : 'none', color: 'var(--text-muted)' }}
                                        title={type}
                                      >{type}</span>
                                    </button>
                                  )
                                })}
                                <div className="flex items-center gap-2 mt-0.5 px-1">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(38,38,38,0.8)', border: '1px solid #525252' }}
                                  />
                                  <span className="text-stone-600">uncreated page</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. COMMAND HELP MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div 
            className="w-full max-w-xl rounded-2xl border p-6 flex flex-col gap-4 shadow-2xl max-h-[85svh] overflow-hidden animate-scale-up"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-850">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h3 className="text-base font-bold text-stone-100 font-serif">Ember Command Reference</h3>
              </div>
              <button 
                onClick={() => {
                  setShowHelpModal(false)
                  setSelectedHelpCommand(null)
                }}
                className="text-stone-400 hover:text-stone-100 text-sm cursor-pointer p-1 transition-all"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5" style={{ scrollbarWidth: 'thin' }}>
              <p className="text-xs text-stone-400 leading-relaxed">
                In W.A.I. (Mind Sailing), you communicate with the compiling agent Ember using hashtag commands in the console. 
                Below is a detailed guide to all available commands.
              </p>

              <div className="flex flex-col gap-2 mt-2">
                {Object.entries(COMMAND_HELP_DETAILS).map(([cmd, details]) => {
                  const isExpanded = selectedHelpCommand === cmd
                  return (
                    <div 
                      key={cmd} 
                      className="rounded-xl border transition-all overflow-hidden" 
                      style={{ 
                        background: 'var(--surface2)', 
                        borderColor: isExpanded ? 'var(--accent)' : 'var(--border)' 
                      }}
                    >
                      <button
                        onClick={() => setSelectedHelpCommand(isExpanded ? null : cmd)}
                        className="w-full text-left px-4 py-3 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all hover:bg-stone-900/40"
                      >
                        <span className="font-mono text-amber-500 font-bold">{cmd}</span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {isExpanded ? 'Collapse ▲' : 'Details ▼'}
                        </span>
                      </button>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-stone-850 text-xs flex flex-col gap-2 text-stone-300 bg-stone-950/20">
                          <p className="leading-relaxed text-stone-300">{details.desc}</p>
                          <div className="grid grid-cols-6 gap-2 text-[11px] font-mono mt-1 bg-black/40 p-2.5 rounded border border-stone-900">
                            <span className="col-span-2 text-stone-500 font-semibold">Usage:</span>
                            <span className="col-span-4 text-stone-300 select-all">{details.usage}</span>
                            <span className="col-span-2 text-stone-500 font-semibold">Example:</span>
                            <span className="col-span-4 text-amber-500/80 select-all">{details.example}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. VAULT TRANSITION MODAL */}
      {vaultTransitionPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
          <div 
            className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-6 shadow-2xl max-h-[85svh] overflow-hidden animate-scale-up"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-col gap-1 border-b pb-3 border-stone-850">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">Voyage Transition</span>
              <h3 className="text-base font-bold text-stone-100 font-serif">Active Discussion Detected</h3>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              You are shifting vaults while in the middle of a Socratic dialogue with Ember. How should we navigate this transition?
            </p>

            <div className="flex flex-col gap-3">
              {/* Option 1: Carry Over */}
              <button
                onClick={handleTransitionKeep}
                className="w-full text-left p-3 rounded-xl border border-stone-800 hover:border-amber-500/30 hover:bg-stone-900/40 transition-all flex flex-col gap-1 cursor-pointer"
              >
                <span className="text-xs font-semibold text-amber-500">⛵ Carry the Winds (Transfer Session)</span>
                <span className="text-[10px] text-stone-500">Maintain the current context and continue your active discussion inside the new vault.</span>
              </button>

              {/* Option 2: Wipe/Reset */}
              <button
                onClick={handleTransitionWipe}
                className="w-full text-left p-3 rounded-xl border border-stone-800 hover:border-amber-500/30 hover:bg-stone-900/40 transition-all flex flex-col gap-1 cursor-pointer"
              >
                <span className="text-xs font-semibold text-stone-300">🧹 Clear the Deck (Fresh Slate)</span>
                <span className="text-[10px] text-stone-500">Purge the current discussion logs and open a clean, empty canvas in the new vault.</span>
              </button>

              {/* Option 3: Archive & Fresh */}
              <button
                onClick={handleTransitionArchiveWipe}
                className="w-full text-left p-3 rounded-xl border border-stone-800 hover:border-amber-500/30 hover:bg-stone-900/40 transition-all flex flex-col gap-1 cursor-pointer"
              >
                <span className="text-xs font-semibold text-emerald-500">📥 Log the Voyage (Archive & Reset)</span>
                <span className="text-[10px] text-stone-500">Safely record this discussion to raw/chats/ in your current vault, then reset the log for the new vault.</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4 border-stone-850">
              <button
                onClick={() => setVaultTransitionPending(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-800 hover:border-stone-700 bg-stone-950/20 text-stone-400 cursor-pointer transition-all"
              >
                Cancel Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
