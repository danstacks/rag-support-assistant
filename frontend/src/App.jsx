import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, FileText, Settings, Database, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Plus, Activity, Clock, MessageSquare, Trash2, Download, ThumbsUp, ThumbsDown, GitBranch, BarChart3, Search, Plug, Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DataManager from './components/DataManager'
import SetupWizard from './components/SetupWizard'
import ServiceMonitor from './components/ServiceMonitor'
import PersonaSettings from './components/PersonaSettings'
import SettingsPanel from './components/SettingsPanel'
import SystemTopology from './components/SystemTopology'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import MCPSettings from './components/MCPSettings'

const API_BASE = '/api'

// Code block component with copy button
const CodeBlock = ({ children, className }) => {
  const [copied, setCopied] = useState(false)
  const codeContent = String(children).replace(/\n$/, '')
  
  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  // Check if it's an inline code or block code
  const isInline = !className && !codeContent.includes('\n')
  
  if (isInline) {
    return <code className="bg-slate-700 px-1.5 py-0.5 rounded text-sm">{children}</code>
  }
  
  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
      </button>
      <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

// Chat history helpers
const CHAT_STORAGE_KEY = 'rag-assistant-chats'
const CURRENT_CHAT_KEY = 'rag-assistant-current-chat'

const loadChats = () => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const saveChats = (chats) => {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
}

const generateChatId = () => `chat-${Date.now()}`

function App() {
  const [showSetup, setShowSetup] = useState(null) // null = checking, true = show wizard, false = show app
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDataManager, setShowDataManager] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)
  const [showPersona, setShowPersona] = useState(false)
  const [health, setHealth] = useState(null)
  const [expandedSources, setExpandedSources] = useState({})
  const messagesEndRef = useRef(null)
  
  // Chat history state
  const [chatHistory, setChatHistory] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState({}) // Track which messages have feedback
  const [showTopology, setShowTopology] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showMCPSettings, setShowMCPSettings] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat history on mount
  useEffect(() => {
    const chats = loadChats()
    setChatHistory(chats)
    
    // Load current chat if exists
    const savedCurrentId = localStorage.getItem(CURRENT_CHAT_KEY)
    if (savedCurrentId) {
      const currentChat = chats.find(c => c.id === savedCurrentId)
      if (currentChat) {
        setCurrentChatId(savedCurrentId)
        setMessages(currentChat.messages || [])
      }
    }
  }, [])

  // Save current chat when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const chatId = currentChatId || generateChatId()
      if (!currentChatId) {
        setCurrentChatId(chatId)
        localStorage.setItem(CURRENT_CHAT_KEY, chatId)
      }
      
      // Get first user message as title
      const firstUserMsg = messages.find(m => m.role === 'user')
      const title = firstUserMsg 
        ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'New Chat'
      
      setChatHistory(prev => {
        const existing = prev.find(c => c.id === chatId)
        const updated = existing
          ? prev.map(c => c.id === chatId ? { ...c, messages, title, updatedAt: Date.now() } : c)
          : [{ id: chatId, title, messages, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
        saveChats(updated)
        return updated
      })
    }
  }, [messages, currentChatId])

  // Chat history functions
  const startNewChat = () => {
    setMessages([])
    setCurrentChatId(null)
    localStorage.removeItem(CURRENT_CHAT_KEY)
    setShowChatHistory(false)
  }

  const loadChat = (chatId) => {
    const chat = chatHistory.find(c => c.id === chatId)
    if (chat) {
      setMessages(chat.messages || [])
      setCurrentChatId(chatId)
      localStorage.setItem(CURRENT_CHAT_KEY, chatId)
      setShowChatHistory(false)
    }
  }

  const deleteChat = (chatId) => {
    setChatHistory(prev => {
      const updated = prev.filter(c => c.id !== chatId)
      saveChats(updated)
      return updated
    })
    if (currentChatId === chatId) {
      startNewChat()
    }
  }

  const exportChat = () => {
    if (messages.length === 0) return
    const content = messages.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`).join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const submitFeedback = async (messageIndex, rating) => {
    const message = messages[messageIndex]
    const prevMessage = messages[messageIndex - 1]
    
    if (!message || message.role !== 'assistant') return
    
    try {
      const formData = new FormData()
      formData.append('query', prevMessage?.content || '')
      formData.append('response', message.content)
      formData.append('rating', rating) // 1 = thumbs down, 2 = thumbs up
      
      await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        body: formData
      })
      
      setFeedbackGiven(prev => ({ ...prev, [messageIndex]: rating }))
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  useEffect(() => {
    // Check if we need to show setup wizard
    const checkSetupStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/setup/status`)
        const data = await response.json()
        
        // Show setup if first run OR if critical components missing
        if (data.is_first_run || !data.ollama_running || !data.model_available) {
          setShowSetup(true)
        } else {
          setShowSetup(false)
          checkHealth()
        }
      } catch (error) {
        // If backend not reachable, show setup wizard
        setShowSetup(true)
      }
    }
    
    checkSetupStatus()
    checkHealth() // Check health immediately on mount
    
    // Periodic health check every 10 seconds
    const healthInterval = setInterval(checkHealth, 10000)
    return () => clearInterval(healthInterval)
  }, [])

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`)
      const data = await response.json()
      setHealth(data)
    } catch (error) {
      setHealth({ status: 'error', error: error.message })
    }
  }

  const sendMessage = async (overrideInput = null) => {
    const messageText = overrideInput || input
    if (!messageText.trim() || isLoading) return

    const userMessage = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    if (!overrideInput) setInput('')
    setIsLoading(true)

    try {
      // Build conversation history for context (last 5 exchanges)
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText, 
          include_sources: true,
          conversation_history: conversationHistory
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        metrics: data.metrics,
        suggestedQuestions: data.metrics?.suggested_questions || []
      }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}. Please check that the backend server and Ollama are running.`,
        isError: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle clicking a suggested question
  const handleSuggestedQuestion = (question) => {
    sendMessage(question)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        if (showDataManager) setShowDataManager(false)
        else if (showMonitor) setShowMonitor(false)
        else if (showPersona) setShowPersona(false)
        else if (showAdvancedSettings) setShowAdvancedSettings(false)
        else if (showTopology) setShowTopology(false)
        else if (showAnalytics) setShowAnalytics(false)
        else if (showMCPSettings) setShowMCPSettings(false)
        else if (showChatHistory) setShowChatHistory(false)
      }
      
      // Ctrl/Cmd + K to focus search/input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('textarea')?.focus()
      }
      
      // Ctrl/Cmd + N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        startNewChat()
      }
      
      // Ctrl/Cmd + H for chat history
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        setShowChatHistory(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [showDataManager, showMonitor, showPersona, showAdvancedSettings, showTopology, showAnalytics, showMCPSettings, showChatHistory])

  const ingestDocs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/ingest/isovalent-docs`, {
        method: 'POST'
      })
      const data = await response.json()
      alert(`Ingestion complete: ${data.message}`)
      checkHealth()
    } catch (error) {
      alert(`Ingestion failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSources = (index) => {
    setExpandedSources(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
    checkHealth()
  }

  // Show loading while checking setup status
  if (showSetup === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  // Show setup wizard if needed
  if (showSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">RAG Support Assistant</h1>
            <p className="text-sm text-slate-400">AI-powered documentation assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {health && (
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${health.ollama_status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-400">Ollama: {health.ollama_status}</span>
              <span className="text-slate-500">|</span>
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">{health.documents_count || 0} docs</span>
            </div>
          )}
          <button
            onClick={startNewChat}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button
            onClick={() => setShowChatHistory(!showChatHistory)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium relative"
            title="Chat History"
          >
            <MessageSquare className="w-4 h-4" />
            History
            {chatHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full text-xs flex items-center justify-center">
                {chatHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowDataManager(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Data
          </button>
          <button
            onClick={() => setShowTopology(true)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="System Topology"
          >
            <GitBranch className="w-5 h-5 text-cyan-400" />
          </button>
          <button
            onClick={() => setShowAnalytics(true)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="Analytics Dashboard"
          >
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </button>
          <button
            onClick={() => setShowMCPSettings(true)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="MCP Integration"
          >
            <Plug className="w-5 h-5 text-emerald-400" />
          </button>
          <button
            onClick={() => setShowMonitor(true)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            title="System Monitor"
          >
            <Activity className="w-5 h-5 text-slate-400" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={checkHealth}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Status
            </button>
            <button
              onClick={() => setShowPersona(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <User className="w-4 h-4" />
              Persona Settings
            </button>
            <button
              onClick={() => setShowAdvancedSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              Advanced Settings
            </button>
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors ml-auto"
            >
              <Settings className="w-4 h-4" />
              Restart Setup Wizard
            </button>
          </div>
        </div>
      )}

      {/* Chat History Panel */}
      {showChatHistory && (
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat History
            </h3>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={exportChat}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              )}
              <button
                onClick={() => setShowChatHistory(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
          {chatHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No chat history yet. Start a conversation!</p>
          ) : (
            <div className="space-y-2">
              {chatHistory.slice(0, 10).map(chat => (
                <div
                  key={chat.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    chat.id === currentChatId 
                      ? 'bg-indigo-900/50 border border-indigo-700' 
                      : 'bg-slate-900 hover:bg-slate-700'
                  }`}
                  onClick={() => loadChat(chat.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(chat.updatedAt).toLocaleDateString()} · {chat.messages?.length || 0} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(chat.id)
                    }}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {chatHistory.length > 10 && (
                <p className="text-xs text-slate-500 text-center">
                  Showing 10 of {chatHistory.length} chats
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
              <Bot className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">From Docs to Expert</h2>
            <p className="text-slate-400 max-w-md mb-4">
              Transform your documentation into an intelligent support assistant.
              Ask questions and get accurate answers grounded in your knowledge base.
            </p>
            
            {health && health.documents_count === 0 ? (
              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 max-w-md mb-8">
                <p className="text-amber-300 text-sm mb-3">
                  <strong>Getting Started:</strong> Add some data to your knowledge base first!
                </p>
                <button
                  onClick={() => setShowDataManager(true)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Your Data
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-8">
                {health?.documents_count || 0} document chunks ready • Ask anything!
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 max-w-2xl">
              <div className="text-xs text-slate-500 mb-1">Try these sample questions:</div>
              <button
                onClick={() => sendMessage("How do I install Tetragon and monitor sensitive file access?")}
                className="px-4 py-3 text-left text-sm bg-slate-800 hover:bg-slate-700 rounded-lg border border-green-700/50 transition-colors"
              >
                <span className="text-green-400 text-xs mr-2">✓ Good Answer</span>
                How do I install Tetragon and monitor sensitive file access?
              </button>
              <button
                onClick={() => sendMessage("Can Tetragon block pluggable peripherals like USB devices as an alternative to endpoint protection software?")}
                className="px-4 py-3 text-left text-sm bg-slate-800 hover:bg-slate-700 rounded-lg border border-amber-700/50 transition-colors"
              >
                <span className="text-amber-400 text-xs mr-2">⚠ Hallucination Test</span>
                Can Tetragon block pluggable peripherals like USB devices as an alternative to endpoint protection software?
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
            )}
            <div className={`max-w-3xl ${message.role === 'user' ? 'order-first' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 ${
                message.role === 'user' 
                  ? 'bg-indigo-600' 
                  : message.isError 
                    ? 'bg-red-900/50 border border-red-700' 
                    : 'bg-slate-800'
              }`}>
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: CodeBlock
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
              
              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleSources(index)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    {message.sources.length} sources
                    {expandedSources[index] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {expandedSources[index] && (
                    <div className="mt-2 space-y-2">
                      {message.sources.map((source, i) => (
                        <div key={i} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
                          <div className="flex items-center gap-2 text-indigo-400 mb-1">
                            <ExternalLink className="w-3 h-3" />
                            <a href={source.source} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                              {source.source}
                            </a>
                          </div>
                          <p className="text-slate-400 text-xs line-clamp-3">{source.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Performance Metrics with Confidence */}
              {message.metrics && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  {/* Confidence Score Badge */}
                  {message.metrics.confidence !== undefined && message.metrics.confidence !== null && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                      message.metrics.confidence >= 70 
                        ? 'bg-green-900/50 text-green-400' 
                        : message.metrics.confidence >= 40 
                          ? 'bg-amber-900/50 text-amber-400'
                          : 'bg-red-900/50 text-red-400'
                    }`}>
                      {message.metrics.confidence >= 70 ? '✓' : message.metrics.confidence >= 40 ? '~' : '?'} {message.metrics.confidence.toFixed(0)}% confident
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {(message.metrics.total_time_ms / 1000).toFixed(1)}s total
                  </span>
                  <span>|</span>
                  <span>Retrieval: {message.metrics.retrieval_time_ms}ms</span>
                  <span>|</span>
                  <span>Generation: {(message.metrics.generation_time_ms / 1000).toFixed(1)}s</span>
                  <span>|</span>
                  <span>{message.metrics.documents_retrieved} docs</span>
                  {message.metrics.total_tokens > 0 && (
                    <>
                      <span>|</span>
                      <span>{message.metrics.total_tokens} tokens</span>
                    </>
                  )}
                </div>
              )}

              {/* Suggested Follow-up Questions */}
              {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2">You might also want to know:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.suggestedQuestions.map((question, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-full transition-colors text-slate-300 hover:text-white"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Buttons */}
              {message.role === 'assistant' && !message.isError && !message.isStreaming && (
                <div className="mt-2 flex items-center gap-2">
                  {feedbackGiven[index] ? (
                    <span className="text-xs text-slate-500">
                      {feedbackGiven[index] === 2 ? '👍 Thanks for the feedback!' : '👎 Thanks, we\'ll improve!'}
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-slate-500 mr-1">Was this helpful?</span>
                      <button
                        onClick={() => submitFeedback(index, 2)}
                        className="p-1.5 rounded hover:bg-green-900/30 text-slate-500 hover:text-green-400 transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => submitFeedback(index, 1)}
                        className="p-1.5 rounded hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 bg-slate-800 border-t border-slate-700">
        <div className="max-w-4xl mx-auto flex gap-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Cilium, Hubble, Tetragon, or Isovalent..."
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">
          Powered by local LLM via Ollama • Your data stays private • Built by Dan Stacks
        </p>
      </div>

      {/* Data Manager Modal */}
      {showDataManager && (
        <DataManager 
          onClose={() => setShowDataManager(false)} 
          onDataChange={checkHealth}
        />
      )}

      {/* System Topology Modal */}
      {showTopology && (
        <SystemTopology onClose={() => setShowTopology(false)} />
      )}

      {/* Analytics Dashboard Modal */}
      {showAnalytics && (
        <AnalyticsDashboard onClose={() => setShowAnalytics(false)} />
      )}

      {/* MCP Settings Modal */}
      <MCPSettings
        isOpen={showMCPSettings}
        onClose={() => setShowMCPSettings(false)}
      />

      {/* Service Monitor Modal */}
      {showMonitor && (
        <ServiceMonitor onClose={() => setShowMonitor(false)} />
      )}

      {/* Persona Settings Modal */}
      <PersonaSettings 
        isOpen={showPersona} 
        onClose={() => setShowPersona(false)} 
      />

      {/* Advanced Settings Modal */}
      <SettingsPanel
        isOpen={showAdvancedSettings}
        onClose={() => setShowAdvancedSettings(false)}
      />
    </div>
  )
}

export default App
