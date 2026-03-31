import { useState, useEffect } from 'react'
import { X, Save, RefreshCw, Cpu, Database, Sliders, Download, Loader2, Check, AlertCircle } from 'lucide-react'

const API_BASE = '/api'

export default function SettingsPanel({ isOpen, onClose }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Model settings
  const [availableModels, setAvailableModels] = useState([])
  const [currentModel, setCurrentModel] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [pullingModel, setPullingModel] = useState(false)
  const [pullProgress, setPullProgress] = useState('')
  const [newModelName, setNewModelName] = useState('')
  
  // RAG settings
  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(200)
  const [topK, setTopK] = useState(5)
  
  // System info
  const [systemInfo, setSystemInfo] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchSettings()
      fetchModels()
      fetchSystemInfo()
    }
  }, [isOpen])

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`)
      if (response.ok) {
        const data = await response.json()
        setChunkSize(data.chunk_size || 1000)
        setChunkOverlap(data.chunk_overlap || 200)
        setTopK(data.top_k || 5)
        setCurrentModel(data.ollama_model || '')
        setSelectedModel(data.ollama_model || '')
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const fetchModels = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/ollama/models`)
      if (response.ok) {
        const data = await response.json()
        setAvailableModels(data.models || [])
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/monitoring/status`)
      if (response.ok) {
        const data = await response.json()
        setSystemInfo(data)
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollama_model: selectedModel,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
          top_k: topK
        })
      })
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved! Restart may be required for some changes.' })
        setCurrentModel(selectedModel)
        setTimeout(() => setMessage(null), 3000)
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setIsSaving(false)
    }
  }

  const pullModel = async () => {
    if (!newModelName.trim()) return
    
    setPullingModel(true)
    setPullProgress('Starting download...')
    
    try {
      const response = await fetch(`${API_BASE}/ollama/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModelName.trim() })
      })
      
      if (response.ok) {
        setPullProgress('Model downloaded successfully!')
        setNewModelName('')
        fetchModels()
        setTimeout(() => setPullProgress(''), 3000)
      } else {
        const data = await response.json()
        setPullProgress(`Error: ${data.detail || 'Failed to pull model'}`)
      }
    } catch (error) {
      setPullProgress(`Error: ${error.message}`)
    } finally {
      setPullingModel(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold">Settings</h2>
              <p className="text-sm text-slate-400">Configure your RAG assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-green-900/50 text-green-300 border border-green-700' 
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* Model Selection */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              AI Model
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Active Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                {currentModel !== selectedModel && (
                  <p className="text-xs text-amber-400 mt-1">
                    Changed from: {currentModel}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-700 pt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Download New Model
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="e.g., llama3:8b, mixtral:8x7b"
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={pullModel}
                    disabled={pullingModel || !newModelName.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {pullingModel ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Pull
                  </button>
                </div>
                {pullProgress && (
                  <p className={`text-xs mt-2 ${pullProgress.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                    {pullProgress}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Popular models: mistral:7b-instruct, llama3:8b, mixtral:8x7b, codellama:13b
                </p>
              </div>
            </div>
          </div>

          {/* RAG Settings */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              RAG Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Chunk Size: {chunkSize} characters
                </label>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="100"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Larger chunks = more context per retrieval, smaller = more precise matching
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Chunk Overlap: {chunkOverlap} characters
                </label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="50"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Overlap helps maintain context between chunks
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Top K Results: {topK}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Number of document chunks to retrieve for each query
                </p>
              </div>
            </div>
          </div>

          {/* System Info */}
          {systemInfo && (
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h3 className="font-medium text-white mb-4">System Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Platform:</span>
                  <span className="ml-2">{systemInfo.system?.platform}</span>
                </div>
                <div>
                  <span className="text-slate-400">Python:</span>
                  <span className="ml-2">{systemInfo.system?.python_version}</span>
                </div>
                {systemInfo.gpu && (
                  <>
                    <div>
                      <span className="text-slate-400">GPU:</span>
                      <span className="ml-2">{systemInfo.gpu.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">VRAM:</span>
                      <span className="ml-2">{systemInfo.gpu.memory_used_mb}MB / {systemInfo.gpu.memory_total_mb}MB</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={fetchModels}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Models
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
