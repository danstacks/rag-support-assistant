import { useState, useEffect, useCallback } from 'react'
import { 
  CheckCircle, XCircle, Loader2, Server, Download, Database, 
  ArrowRight, RefreshCw, Rocket, FileText, Globe, AlertTriangle,
  BookOpen, Cpu, Brain, Search, MessageSquare, Lightbulb, ChevronDown, ChevronUp
} from 'lucide-react'

const API_BASE = '/api'

const steps = [
  { 
    id: 'ollama', 
    title: 'Ollama Service', 
    description: 'Local LLM runtime',
    learnTitle: 'What is Ollama?',
    learnContent: `Ollama is an open-source tool that lets you run Large Language Models (LLMs) locally on your own hardware. 

**Why local?**
• Your data never leaves your server - critical for enterprise security
• No API costs or rate limits
• Works offline once set up
• Full control over the model and its behavior

**How it works:**
Ollama manages downloading, running, and serving LLM models. It exposes a simple API that our backend calls to generate responses. Think of it as "Docker for LLMs" - it handles all the complexity of running AI models.`
  },
  { 
    id: 'model', 
    title: 'AI Model', 
    description: 'Download language model',
    learnTitle: 'What is Mistral 7B?',
    learnContent: `Mistral 7B Instruct is a powerful open-source language model with 7 billion parameters, fine-tuned to follow instructions.

**Why this model?**
• Excellent balance of quality and speed
• Runs well on a single GPU (needs ~6GB VRAM)
• Strong at following instructions and answering questions
• Open-source with permissive license

**What are "parameters"?**
Parameters are the learned values in a neural network. More parameters generally means more capability, but also more memory and compute needed. 7B is a sweet spot for local deployment.

**The download:**
The model is ~4GB. Once downloaded, it stays on your server and loads into GPU memory when needed.`
  },
  { 
    id: 'data', 
    title: 'Knowledge Base', 
    description: 'Load documentation',
    learnTitle: 'How RAG Works',
    learnContent: `RAG (Retrieval-Augmented Generation) is the technique that makes this assistant accurate and grounded in your documentation.

**The Problem with Plain LLMs:**
LLMs are trained on general internet data. They don't know YOUR specific documentation, and they can "hallucinate" - confidently make up information.

**How RAG Solves This:**

1. **Chunking**: Your documents are split into smaller pieces (~1000 characters each)

2. **Embedding**: Each chunk is converted to a "vector" - a list of numbers that captures its meaning. Similar content has similar vectors.

3. **Indexing**: Vectors are stored in a vector database (ChromaDB) for fast similarity search.

4. **Retrieval**: When you ask a question, we find the most relevant chunks by comparing vector similarity.

5. **Generation**: The LLM receives your question PLUS the relevant chunks, and generates an answer grounded in that context.

**The Result:**
Answers cite real sources. The LLM can only use information from your docs, dramatically reducing hallucination.`
  },
  { 
    id: 'persona', 
    title: 'Assistant Persona', 
    description: 'Configure behavior',
    learnTitle: 'What is a Persona?',
    learnContent: `The persona defines how your assistant behaves and responds. It's the "system prompt" that shapes the AI's personality and expertise.

**Why customize it?**
• Define the assistant's area of expertise
• Set the tone (technical, friendly, formal)
• Control how it handles uncertainty
• Specify citation and source requirements

**The default persona:**
A technical expert persona is configured from your domain.yaml that:
• Only answers from provided documentation
• Admits when it doesn't have enough information
• Provides code examples when relevant
• Uses a precise, technical tone

**Customization:**
You can modify the persona anytime in Settings → Persona Settings to match your specific use case.`
  },
]

// Component to render markdown-like content
function LearnContent({ content }) {
  const lines = content.split('\n')
  return (
    <div className="text-sm text-slate-300 space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-white mt-3">{line.replace(/\*\*/g, '')}</p>
        } else if (line.startsWith('• ')) {
          return <p key={i} className="pl-4">• {line.slice(2)}</p>
        } else if (line.match(/^\d+\. \*\*/)) {
          const match = line.match(/^(\d+)\. \*\*(.+?)\*\*:?\s*(.*)/)
          if (match) {
            return (
              <p key={i} className="pl-4">
                <span className="text-indigo-400">{match[1]}.</span>{' '}
                <span className="font-semibold text-white">{match[2]}</span>
                {match[3] && `: ${match[3]}`}
              </p>
            )
          }
        } else if (line.trim()) {
          return <p key={i}>{line}</p>
        }
        return null
      })}
    </div>
  )
}

export default function SetupWizard({ onComplete }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(0)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState(null)
  const [expandedLearn, setExpandedLearn] = useState({})

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/setup/status`)
      const data = await response.json()
      setStatus(data)
      setError(null)
      
      // Check if setup is already complete
      if (data.setup_complete && !data.is_first_run) {
        onComplete?.()
      }
    } catch (err) {
      setError('Cannot connect to backend. Make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }, [onComplete])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Poll for pull progress when pulling
  useEffect(() => {
    if (!pulling) return
    
    const pollProgress = async () => {
      try {
        const response = await fetch(`${API_BASE}/setup/pull-progress`)
        const data = await response.json()
        setPullProgress(data.progress || 0)
        
        if (!data.pulling && pullProgress > 0) {
          setPulling(false)
          fetchStatus()
        }
      } catch (err) {
        console.error('Error polling progress:', err)
      }
    }
    
    const interval = setInterval(pollProgress, 1000)
    return () => clearInterval(interval)
  }, [pulling, pullProgress, fetchStatus])

  const pullModel = async () => {
    setPulling(true)
    setPullProgress(0)
    try {
      await fetch(`${API_BASE}/setup/pull-model`, { method: 'POST' })
    } catch (err) {
      setError('Failed to start model download')
      setPulling(false)
    }
  }

  const loadSampleData = async () => {
    setLoadingData(true)
    try {
      const response = await fetch(`${API_BASE}/setup/load-sample-data`, { method: 'POST' })
      const data = await response.json()
      if (data.status === 'success') {
        fetchStatus()
      } else {
        setError(data.message || 'Failed to load sample data')
      }
    } catch (err) {
      setError('Failed to load sample data')
    } finally {
      setLoadingData(false)
    }
  }

  const completeSetup = async () => {
    try {
      await fetch(`${API_BASE}/setup/complete`, { method: 'POST' })
      onComplete?.()
    } catch (err) {
      setError('Failed to complete setup')
    }
  }

  const getStepStatus = (stepId) => {
    if (!status) return 'pending'
    
    switch (stepId) {
      case 'ollama':
        return status.ollama_running ? 'complete' : 'error'
      case 'model':
        if (pulling) return 'loading'
        return status.model_available ? 'complete' : 'pending'
      case 'data':
        if (loadingData) return 'loading'
        return status.documents_loaded > 0 ? 'complete' : 'pending'
      case 'persona':
        // Persona is auto-configured when model is available
        return status.model_available ? 'complete' : 'pending'
      default:
        return 'pending'
    }
  }

  const StepIcon = ({ stepStatus }) => {
    switch (stepStatus) {
      case 'complete':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />
      case 'loading':
        return <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      default:
        return <div className="w-6 h-6 rounded-full border-2 border-slate-600" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  const allComplete = status?.ollama_running && status?.model_available && status?.documents_loaded > 0

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to RAG Support Assistant</h1>
          <p className="text-slate-400 mb-4">Let's get your support assistant up and running</p>
          
          {/* What we're building */}
          <div className="bg-slate-800/50 rounded-xl p-4 text-left max-w-xl mx-auto">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-slate-300 mb-2">
                  <strong className="text-white">What you're building:</strong> A RAG-powered support assistant that answers questions using YOUR documentation.
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Local LLM</span>
                  <span className="flex items-center gap-1"><Search className="w-3 h-3" /> Vector Search</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Chat Interface</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              ×
            </button>
          </div>
        )}

        {/* Steps */}
        <div className="bg-slate-800 rounded-2xl p-6 mb-6">
          <div className="space-y-6">
            {steps.map((step, index) => {
              const stepStatus = getStepStatus(step.id)
              
              return (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <StepIcon stepStatus={stepStatus} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold">{step.title}</h3>
                      {stepStatus === 'complete' && (
                        <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">Ready</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{step.description}</p>
                    
                    {/* Learn More Section */}
                    <button
                      onClick={() => setExpandedLearn(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mb-3 transition-colors"
                    >
                      <Lightbulb className="w-3 h-3" />
                      {step.learnTitle}
                      {expandedLearn[step.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    
                    {expandedLearn[step.id] && (
                      <div className="mb-4 p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
                        <LearnContent content={step.learnContent} />
                      </div>
                    )}
                    
                    {/* Step-specific content */}
                    {step.id === 'ollama' && (
                      <div className="text-sm">
                        {status?.ollama_running ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <Server className="w-4 h-4" />
                            Ollama is running at localhost:11434
                          </div>
                        ) : (
                          <div className="bg-slate-900 rounded-lg p-4">
                            <p className="text-amber-400 mb-2">Ollama is not running</p>
                            <p className="text-slate-400 text-xs mb-2">Start Ollama on your server:</p>
                            <code className="block bg-slate-950 p-2 rounded text-xs text-slate-300">
                              ollama serve
                            </code>
                            <button 
                              onClick={fetchStatus}
                              className="mt-3 flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              <RefreshCw className="w-3 h-3" /> Check again
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {step.id === 'model' && status?.ollama_running && (
                      <div className="text-sm">
                        {status?.model_available ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <Download className="w-4 h-4" />
                            {status.model_name} is ready
                          </div>
                        ) : pulling ? (
                          <div className="bg-slate-900 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-300">Downloading {status?.model_name}...</span>
                              <span className="text-indigo-400">{Math.round(pullProgress)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${pullProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">This may take a few minutes...</p>
                          </div>
                        ) : (
                          <div className="bg-slate-900 rounded-lg p-4">
                            <p className="text-slate-400 mb-3">
                              Download <strong>{status?.model_name}</strong> (~4GB)
                            </p>
                            <button
                              onClick={pullModel}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download Model
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {step.id === 'data' && status?.model_available && (
                      <div className="text-sm">
                        {status?.documents_loaded > 0 ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <Database className="w-4 h-4" />
                            {status.documents_loaded} document chunks indexed
                          </div>
                        ) : (
                          <div className="bg-slate-900 rounded-lg p-4">
                            <p className="text-slate-400 mb-3">
                              Load sample documentation to get started
                            </p>
                            <button
                              onClick={loadSampleData}
                              disabled={loadingData}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {loadingData ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                              {loadingData ? 'Loading...' : 'Load Sample Data'}
                            </button>
                            <p className="text-xs text-slate-500 mt-3">
                              Or add your own data after setup using the "Add Data" button
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {step.id === 'persona' && status?.model_available && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-green-400">
                          <Brain className="w-4 h-4" />
                          Default Technical Expert persona configured
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          You can customize this later in Settings → Persona Settings
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Complete Button */}
        {allComplete && (
          <button
            onClick={completeSetup}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-semibold text-lg transition-all"
          >
            Start Using Your Assistant
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {/* Skip option */}
        {!allComplete && status?.ollama_running && status?.model_available && (
          <button
            onClick={completeSetup}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-400 mt-4"
          >
            Skip for now - I'll add data later
          </button>
        )}
      </div>
    </div>
  )
}
