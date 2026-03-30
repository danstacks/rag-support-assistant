import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, FileText, Settings, Database, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Plus, Activity } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DataManager from './components/DataManager'
import SetupWizard from './components/SetupWizard'
import ServiceMonitor from './components/ServiceMonitor'

const API_BASE = '/api'

function App() {
  const [showSetup, setShowSetup] = useState(null) // null = checking, true = show wizard, false = show app
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDataManager, setShowDataManager] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)
  const [health, setHealth] = useState(null)
  const [expandedSources, setExpandedSources] = useState({})
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, include_sources: true })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

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
            onClick={() => setShowDataManager(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Data
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
          <div className="flex items-center gap-4">
            <button
              onClick={ingestDocs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Ingest Isovalent Docs
            </button>
            <button
              onClick={checkHealth}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Status
            </button>
          </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {[
                "How do I get started?",
                "What are the main features?",
                "How do I troubleshoot common issues?",
                "Explain the architecture"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-3 text-left text-sm bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
            onKeyPress={handleKeyPress}
            placeholder="Ask about Cilium, Hubble, Tetragon, or Isovalent..."
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
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

      {/* Service Monitor Modal */}
      {showMonitor && (
        <ServiceMonitor onClose={() => setShowMonitor(false)} />
      )}
    </div>
  )
}

export default App
