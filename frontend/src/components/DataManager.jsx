import { useState, useCallback, useEffect } from 'react'
import { 
  Globe, Upload, FileText, Trash2, RefreshCw, CheckCircle, 
  AlertCircle, X, FolderOpen, Link, ChevronDown, ChevronUp,
  Database, Loader2, Zap, Settings, BookOpen, Shield, Eye,
  Clock, Play, Pause, Calendar, RotateCcw, Download, UploadCloud,
  Link2, Building2, Key, List, Search
} from 'lucide-react'

const API_BASE = '/api'

// Preset icons and colors
const PRESET_INFO = {
  isovalent: { icon: Zap, color: 'text-orange-400', desc: 'All Isovalent open source docs' },
  cilium: { icon: Globe, color: 'text-green-400', desc: 'Cilium networking (~500 pages)' },
  hubble: { icon: Eye, color: 'text-blue-400', desc: 'Hubble observability (~100 pages)' },
  tetragon: { icon: Shield, color: 'text-purple-400', desc: 'Tetragon security (~200 pages)' },
}

export default function DataManager({ onClose, onDataChange }) {
  const [activeTab, setActiveTab] = useState('presets')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [docCount, setDocCount] = useState(0)
  const [presets, setPresets] = useState([])
  
  // Crawl state
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawlRecursive, setCrawlRecursive] = useState(true)
  const [crawlDepth, setCrawlDepth] = useState(3)
  const [crawlMaxPages, setCrawlMaxPages] = useState(500)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [crawlJobId, setCrawlJobId] = useState(null)
  const [crawlStatus, setCrawlStatus] = useState(null)
  // Authentication state
  const [authMethod, setAuthMethod] = useState('none') // none, bearer, basic, cookie
  const [basicUsername, setBasicUsername] = useState('')
  const [basicPassword, setBasicPassword] = useState('')
  const [cookieString, setCookieString] = useState('')
  
  // Upload state
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  
  // Text input state
  const [textContent, setTextContent] = useState('')
  const [textSourceName, setTextSourceName] = useState('')
  
  // Pipeline state
  const [pipelines, setPipelines] = useState([])
  const [pipelineFrequency, setPipelineFrequency] = useState('once')
  const [customInterval, setCustomInterval] = useState(60)
  const [showPipelineForm, setShowPipelineForm] = useState(false)
  const [pipelineName, setPipelineName] = useState('')
  
  // Wiki connection state
  const [wikiType, setWikiType] = useState('confluence')
  const [wikiUrl, setWikiUrl] = useState('')
  const [wikiSpaceKey, setWikiSpaceKey] = useState('')
  const [wikiAuthMethod, setWikiAuthMethod] = useState('none')
  const [wikiToken, setWikiToken] = useState('')
  const [wikiUsername, setWikiUsername] = useState('')
  const [wikiPassword, setWikiPassword] = useState('')
  const [wikiCookies, setWikiCookies] = useState('')
  
  // Document management state
  const [documentList, setDocumentList] = useState([])
  const [docSearchQuery, setDocSearchQuery] = useState('')

  const fetchDocCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/count`)
      const data = await response.json()
      setDocCount(data.count)
    } catch (error) {
      console.error('Failed to fetch doc count:', error)
    }
  }, [])

  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/ingest/presets`)
      const data = await response.json()
      setPresets(data.presets || [])
    } catch (error) {
      console.error('Failed to fetch presets:', error)
    }
  }, [])

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/pipelines`)
      const data = await response.json()
      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Failed to fetch pipelines:', error)
    }
  }, [])

  const loadSampleData = async () => {
    setIsLoading(true)
    showStatus('info', 'Loading sample Isovalent/Cilium documentation...')
    try {
      const response = await fetch(`${API_BASE}/setup/load-sample-data`, { method: 'POST' })
      const data = await response.json()
      if (response.ok && data.status === 'success') {
        showStatus('success', `Loaded ${data.documents_loaded} document chunks`)
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.message || 'Failed to load sample data')
      }
    } catch (error) {
      showStatus('error', `Failed to load sample data: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const exportData = async () => {
    setIsLoading(true)
    showStatus('info', 'Preparing export...')
    try {
      const response = await fetch(`${API_BASE}/export/data`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rag-assistant-export-${new Date().toISOString().slice(0,10)}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showStatus('success', 'Export downloaded successfully!')
      } else {
        showStatus('error', 'Export failed')
      }
    } catch (error) {
      showStatus('error', `Export failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const importData = async (file, merge = false) => {
    setIsLoading(true)
    showStatus('info', 'Importing data...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('merge', merge)
      
      const response = await fetch(`${API_BASE}/import/data`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      if (data.status === 'success') {
        showStatus('success', data.message)
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.message || 'Import failed')
      }
    } catch (error) {
      showStatus('error', `Import failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDocumentList = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/documents/list`)
      const data = await response.json()
      setDocumentList(data.documents || [])
    } catch (error) {
      console.error('Failed to fetch document list:', error)
    }
  }, [])

  const deleteDocument = async (source) => {
    if (!confirm(`Delete all chunks from "${source}"?`)) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/documents/source?source=${encodeURIComponent(source)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.status === 'success') {
        showStatus('success', data.message)
        fetchDocumentList()
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.message)
      }
    } catch (error) {
      showStatus('error', `Failed to delete: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const connectWiki = async () => {
    if (!wikiUrl) {
      showStatus('error', 'Please enter the wiki URL')
      return
    }
    
    setIsLoading(true)
    showStatus('info', `Connecting to ${wikiType}... This may take several minutes.`)
    
    try {
      const formData = new FormData()
      formData.append('url', wikiUrl)
      formData.append('recursive', 'true')
      formData.append('max_depth', '4')
      formData.append('max_pages', '500')
      formData.append('platform', wikiType)
      
      if (wikiSpaceKey) {
        formData.append('space_key', wikiSpaceKey)
      }
      
      // Add authentication based on method
      if (wikiAuthMethod === 'bearer' && wikiToken) {
        formData.append('auth_token', wikiToken)
      } else if (wikiAuthMethod === 'basic' && wikiUsername && wikiPassword) {
        formData.append('basic_auth_username', wikiUsername)
        formData.append('basic_auth_password', wikiPassword)
      } else if (wikiAuthMethod === 'cookie' && wikiCookies) {
        formData.append('cookie_string', wikiCookies)
      }
      
      const response = await fetch(`${API_BASE}/ingest/url`, {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      if (response.ok) {
        showStatus('success', data.message || `Connected! Indexed ${data.documents_processed} chunks.`)
        fetchDocCount()
        onDataChange?.()
        // Clear form
        setWikiUrl('')
        setWikiSpaceKey('')
        setWikiToken('')
        setWikiUsername('')
        setWikiPassword('')
        setWikiCookies('')
      } else {
        showStatus('error', data.detail || 'Connection failed')
      }
    } catch (error) {
      showStatus('error', `Connection failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocCount()
    fetchPresets()
    fetchPipelines()
    fetchDocumentList()
  }, [fetchDocCount, fetchPresets, fetchPipelines, fetchDocumentList])

  const showStatus = (type, message) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 5000)
  }

  const handlePresetScrape = async (presetName, asPipeline = false) => {
    setIsLoading(true)
    
    if (asPipeline && pipelineFrequency !== 'once') {
      // Create as a scheduled pipeline
      showStatus('info', `Creating ${presetName} pipeline...`)
      try {
        const formData = new FormData()
        formData.append('preset_name', presetName)
        formData.append('frequency', pipelineFrequency)
        formData.append('custom_interval_minutes', customInterval)
        
        const response = await fetch(`${API_BASE}/pipelines/preset`, {
          method: 'POST',
          body: formData
        })
        
        const data = await response.json()
        if (response.ok) {
          showStatus('success', `Pipeline created! Will run ${pipelineFrequency}.`)
          fetchPipelines()
          // Run immediately
          await fetch(`${API_BASE}/pipelines/${data.pipeline.id}/run`, { method: 'POST' })
          fetchDocCount()
          onDataChange?.()
        } else {
          showStatus('error', data.detail || 'Failed to create pipeline')
        }
      } catch (error) {
        showStatus('error', `Failed: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
      return
    }
    
    // One-time scrape
    showStatus('info', `Scraping ${presetName} documentation... This may take several minutes.`)
    
    try {
      const response = await fetch(`${API_BASE}/ingest/preset/${presetName}`, {
        method: 'POST'
      })

      const data = await response.json()
      if (response.ok) {
        showStatus('success', data.message)
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.detail || 'Scrape failed')
      }
    } catch (error) {
      showStatus('error', `Scrape failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRunPipeline = async (pipelineId) => {
    setIsLoading(true)
    showStatus('info', 'Running pipeline...')
    try {
      const response = await fetch(`${API_BASE}/pipelines/${pipelineId}/run`, {
        method: 'POST'
      })
      const data = await response.json()
      if (response.ok) {
        showStatus('success', data.message)
        fetchPipelines()
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.detail || 'Pipeline run failed')
      }
    } catch (error) {
      showStatus('error', `Pipeline run failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTogglePipeline = async (pipelineId, enabled) => {
    try {
      const formData = new FormData()
      formData.append('enabled', !enabled)
      await fetch(`${API_BASE}/pipelines/${pipelineId}`, {
        method: 'PATCH',
        body: formData
      })
      fetchPipelines()
    } catch (error) {
      showStatus('error', 'Failed to toggle pipeline')
    }
  }

  const handleDeletePipeline = async (pipelineId) => {
    if (!confirm('Delete this pipeline?')) return
    try {
      await fetch(`${API_BASE}/pipelines/${pipelineId}`, { method: 'DELETE' })
      fetchPipelines()
      showStatus('success', 'Pipeline deleted')
    } catch (error) {
      showStatus('error', 'Failed to delete pipeline')
    }
  }

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) {
      showStatus('error', 'Please enter a URL to crawl')
      return
    }

    setIsLoading(true)
    setCrawlStatus({ status: 'starting', pages_processed: 0, pages_found: 0 })
    
    try {
      // Use advanced endpoint if auth or platform specified
      const hasAuth = authMethod !== 'none' && (authToken || basicUsername || cookieString)
      const useAdvanced = hasAuth || platform !== 'auto' || crawlMaxPages !== 500
      
      let response
      if (useAdvanced) {
        const formData = new FormData()
        formData.append('url', crawlUrl)
        formData.append('recursive', crawlRecursive)
        formData.append('max_depth', crawlDepth)
        formData.append('max_pages', crawlMaxPages)
        formData.append('platform', platform)
        if (authMethod === 'bearer' && authToken) {
          formData.append('auth_token', authToken)
        }
        if (authMethod === 'basic' && basicUsername) {
          formData.append('basic_auth_username', basicUsername)
          formData.append('basic_auth_password', basicPassword)
        }
        if (authMethod === 'cookie' && cookieString) {
          formData.append('cookie_string', cookieString)
        }
        
        response = await fetch(`${API_BASE}/ingest/advanced`, {
          method: 'POST',
          body: formData
        })
      } else {
        response = await fetch(`${API_BASE}/ingest/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: crawlUrl,
            recursive: crawlRecursive,
            max_depth: crawlDepth
          })
        })
      }

      const data = await response.json()
      
      // Check if this is a job-based response
      if (data.job_id) {
        setCrawlJobId(data.job_id)
        // Start polling for status
        pollJobStatus(data.job_id)
      } else if (response.ok) {
        showStatus('success', data.message)
        setCrawlUrl('')
        setCrawlStatus(null)
        setIsLoading(false)
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.detail || 'Crawl failed')
        setCrawlStatus(null)
        setIsLoading(false)
      }
    } catch (error) {
      showStatus('error', `Crawl failed: ${error.message}`)
      setCrawlStatus(null)
      setIsLoading(false)
    }
  }

  const pollJobStatus = async (jobId) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}`)
        if (!response.ok) return
        
        const status = await response.json()
        setCrawlStatus(status)
        
        if (status.completed) {
          setCrawlJobId(null)
          setIsLoading(false)
          
          if (status.status === 'completed') {
            showStatus('success', `Crawl complete! Indexed ${status.documents_indexed} document chunks from ${status.pages_processed} pages`)
            setCrawlUrl('')
            fetchDocCount()
            fetchDocumentList()
            onDataChange?.()
          } else if (status.status === 'cancelled') {
            showStatus('info', `Crawl cancelled. Indexed ${status.documents_indexed} chunks from ${status.pages_processed} pages`)
            fetchDocCount()
            fetchDocumentList()
            onDataChange?.()
          } else if (status.error) {
            showStatus('error', `Crawl failed: ${status.error}`)
          }
          setCrawlStatus(null)
        } else {
          // Continue polling
          setTimeout(poll, 1000)
        }
      } catch (error) {
        console.error('Failed to poll job status:', error)
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  const cancelCrawl = async () => {
    if (!crawlJobId) return
    
    try {
      await fetch(`${API_BASE}/jobs/${crawlJobId}/cancel`, { method: 'POST' })
      setCrawlStatus(prev => prev ? { ...prev, status: 'cancelling' } : null)
    } catch (error) {
      console.error('Failed to cancel crawl:', error)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = [...e.dataTransfer.files]
    handleFiles(files)
  }

  const handleFileInput = (e) => {
    const files = [...e.target.files]
    handleFiles(files)
  }

  const handleFiles = (files) => {
    const validExtensions = ['.md', '.txt', '.html', '.htm', '.rst', '.json', '.pdf', '.docx']
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      return validExtensions.includes(ext)
    })
    
    if (validFiles.length < files.length) {
      showStatus('error', `Some files were skipped. Supported: ${validExtensions.join(', ')}`)
    }
    
    setUploadedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) {
      showStatus('error', 'Please select files to upload')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      uploadedFiles.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch(`${API_BASE}/ingest/files`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (response.ok) {
        showStatus('success', data.message)
        setUploadedFiles([])
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.detail || 'Upload failed')
      }
    } catch (error) {
      showStatus('error', `Upload failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTextSubmit = async () => {
    if (!textContent.trim()) {
      showStatus('error', 'Please enter some text content')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('content', textContent)
      formData.append('source_name', textSourceName || 'Manual Input')
      formData.append('doc_type', 'text')

      const response = await fetch(`${API_BASE}/ingest/text`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (response.ok) {
        showStatus('success', data.message)
        setTextContent('')
        setTextSourceName('')
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', data.detail || 'Text ingestion failed')
      }
    } catch (error) {
      showStatus('error', `Text ingestion failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearAllDocuments = async () => {
    if (!confirm('Are you sure you want to delete all indexed documents? This cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/documents`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showStatus('success', 'All documents cleared')
        fetchDocCount()
        onDataChange?.()
      } else {
        showStatus('error', 'Failed to clear documents')
      }
    } catch (error) {
      showStatus('error', `Failed to clear documents: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { id: 'presets', label: 'Quick Start', icon: Zap },
    { id: 'wiki', label: 'Connect Wiki', icon: Building2 },
    { id: 'documents', label: 'Documents', icon: List },
    { id: 'pipelines', label: 'Pipelines', icon: RotateCcw },
    { id: 'crawl', label: 'Crawl Website', icon: Globe },
    { id: 'upload', label: 'Upload Files', icon: Upload },
    { id: 'text', label: 'Paste Text', icon: FileText },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold">Knowledge Base</h2>
              <p className="text-sm text-slate-400">{docCount} document chunks indexed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${
            status.type === 'success' ? 'bg-green-900/50 text-green-300' : 
            status.type === 'info' ? 'bg-blue-900/50 text-blue-300' :
            'bg-red-900/50 text-red-300'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
             status.type === 'info' ? <Loader2 className="w-5 h-5 animate-spin" /> :
             <AlertCircle className="w-5 h-5" />}
            {status.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-700/50' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">Quick Start with Presets</h3>
                <p className="text-sm text-slate-400">
                  One-click scraping of popular documentation sources. Perfect for demos or getting started quickly.
                </p>
              </div>

              {/* Load Sample Data Button */}
              <button
                onClick={loadSampleData}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/50 hover:to-purple-800/50 border border-indigo-700 rounded-lg transition-colors text-left disabled:opacity-50 mb-4"
              >
                <div className="p-3 rounded-lg bg-indigo-600">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">Load Sample Data</h4>
                  <p className="text-sm text-slate-300">Pre-bundled Isovalent/Cilium docs (instant, no scraping)</p>
                </div>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                ) : (
                  <Zap className="w-5 h-5 text-indigo-400" />
                )}
              </button>

              <div className="text-xs text-slate-500 mb-4 text-center">— or scrape live documentation —</div>

              <div className="grid gap-3">
                {presets.map(preset => {
                  const info = PRESET_INFO[preset] || { icon: BookOpen, color: 'text-slate-400', desc: preset }
                  const Icon = info.icon
                  
                  return (
                    <button
                      key={preset}
                      onClick={() => handlePresetScrape(preset)}
                      disabled={isLoading}
                      className="flex items-center gap-4 p-4 bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors text-left disabled:opacity-50"
                    >
                      <div className={`p-3 rounded-lg bg-slate-800 ${info.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium capitalize">{preset}</h4>
                        <p className="text-sm text-slate-400">{info.desc}</p>
                      </div>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 rotate-[-90deg]" />
                      )}
                    </button>
                  )
                })}
              </div>

              </div>
          )}

          {/* Connect Wiki Tab */}
          {activeTab === 'wiki' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">Connect to Your Internal Wiki</h3>
                <p className="text-sm text-slate-400">
                  Connect to Confluence, SharePoint, or other internal documentation systems.
                </p>
              </div>

              {/* Wiki Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Wiki Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'confluence', label: 'Confluence', icon: '📘' },
                    { id: 'sharepoint', label: 'SharePoint', icon: '📁' },
                    { id: 'generic', label: 'Other Wiki', icon: '🌐' },
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setWikiType(type.id)}
                      className={`p-3 rounded-lg border transition-colors text-center ${
                        wikiType === type.id
                          ? 'border-indigo-500 bg-indigo-900/30 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{type.icon}</span>
                      <div className="text-sm mt-1">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wiki URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {wikiType === 'confluence' ? 'Confluence URL' : wikiType === 'sharepoint' ? 'SharePoint Site URL' : 'Wiki URL'}
                </label>
                <input
                  type="url"
                  value={wikiUrl}
                  onChange={(e) => setWikiUrl(e.target.value)}
                  placeholder={
                    wikiType === 'confluence' 
                      ? 'https://yourcompany.atlassian.net/wiki' 
                      : wikiType === 'sharepoint'
                      ? 'https://yourcompany.sharepoint.com/sites/docs'
                      : 'https://wiki.yourcompany.com'
                  }
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Space Key for Confluence */}
              {wikiType === 'confluence' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Space Key (optional)</label>
                  <input
                    type="text"
                    value={wikiSpaceKey}
                    onChange={(e) => setWikiSpaceKey(e.target.value)}
                    placeholder="e.g., DOCS, KB, ENGINEERING"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave empty to crawl all accessible spaces</p>
                </div>
              )}

              {/* Authentication */}
              <div>
                <label className="block text-sm font-medium mb-2">Authentication</label>
                <select
                  value={wikiAuthMethod}
                  onChange={(e) => setWikiAuthMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">No Authentication (Public)</option>
                  <option value="bearer">API Token / Bearer Token</option>
                  <option value="basic">Username & Password</option>
                  <option value="cookie">Browser Cookies</option>
                </select>
              </div>

              {/* Auth Fields */}
              {wikiAuthMethod === 'bearer' && (
                <div>
                  <label className="block text-sm font-medium mb-2">API Token</label>
                  <input
                    type="password"
                    value={wikiToken}
                    onChange={(e) => setWikiToken(e.target.value)}
                    placeholder="Your API token or Personal Access Token"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {wikiType === 'confluence' 
                      ? 'Generate at: Atlassian Account → Security → API tokens'
                      : 'Check your wiki documentation for API token generation'}
                  </p>
                </div>
              )}

              {wikiAuthMethod === 'basic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Username / Email</label>
                    <input
                      type="text"
                      value={wikiUsername}
                      onChange={(e) => setWikiUsername(e.target.value)}
                      placeholder="your.email@company.com"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Password / API Token</label>
                    <input
                      type="password"
                      value={wikiPassword}
                      onChange={(e) => setWikiPassword(e.target.value)}
                      placeholder="Password or API token"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {wikiAuthMethod === 'cookie' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Cookie String</label>
                  <textarea
                    value={wikiCookies}
                    onChange={(e) => setWikiCookies(e.target.value)}
                    placeholder="Paste cookies from browser DevTools (Network tab → Copy as cURL → extract Cookie header)"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    For SSO-protected wikis: Log in via browser, then copy cookies from DevTools
                  </p>
                </div>
              )}

              {/* Connect Button */}
              <button
                onClick={connectWiki}
                disabled={isLoading || !wikiUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-5 h-5" />
                    Connect & Import
                  </>
                )}
              </button>

              {/* Help Text */}
              <div className="p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
                <h4 className="font-medium text-amber-300 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Authentication Tips
                </h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• <strong>Confluence Cloud:</strong> Use email + API token (not password)</li>
                  <li>• <strong>Confluence Server:</strong> Use username + password or PAT</li>
                  <li>• <strong>SharePoint:</strong> May require app registration or cookies</li>
                  <li>• <strong>SSO/SAML:</strong> Use the cookie method after logging in via browser</li>
                </ul>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">Indexed Documents</h3>
                <p className="text-sm text-slate-400">
                  View and manage documents in your knowledge base. Delete individual sources without clearing everything.
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Document List */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {documentList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No documents indexed yet</p>
                    <p className="text-sm">Add data using the other tabs</p>
                  </div>
                ) : (
                  documentList
                    .filter(doc => 
                      !docSearchQuery || 
                      doc.source.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
                      doc.title?.toLowerCase().includes(docSearchQuery.toLowerCase())
                    )
                    .map((doc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium truncate" title={doc.title || doc.source}>
                            {doc.title || doc.source}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="px-2 py-0.5 bg-slate-800 rounded">{doc.type}</span>
                            <span>{doc.chunk_count} chunks</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteDocument(doc.source)}
                          disabled={isLoading}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                          title="Delete this source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                )}
              </div>

              {/* Summary */}
              {documentList.length > 0 && (
                <div className="flex items-center justify-between text-sm text-slate-400 pt-2 border-t border-slate-700">
                  <span>{documentList.length} sources</span>
                  <button
                    onClick={fetchDocumentList}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pipelines Tab */}
          {activeTab === 'pipelines' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">Scheduled Pipelines</h3>
                <p className="text-sm text-slate-400">
                  Set up recurring scrapes to keep your knowledge base in sync with source documentation.
                  Changes are detected automatically - only new/updated content is processed.
                </p>
              </div>

              {/* Frequency selector for new pipelines */}
              <div className="p-4 bg-slate-900 rounded-lg">
                <label className="block text-sm font-medium mb-3">Default Schedule for New Pipelines</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { value: 'once', label: 'One-time', icon: Zap },
                    { value: 'hourly', label: 'Hourly', icon: Clock },
                    { value: 'daily', label: 'Daily', icon: Calendar },
                    { value: 'weekly', label: 'Weekly', icon: Calendar },
                    { value: 'custom', label: 'Custom', icon: Settings },
                  ].map(freq => (
                    <button
                      key={freq.value}
                      onClick={() => setPipelineFrequency(freq.value)}
                      className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                        pipelineFrequency === freq.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <freq.icon className="w-4 h-4 mx-auto mb-1" />
                      {freq.label}
                    </button>
                  ))}
                </div>
                
                {pipelineFrequency === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1">Interval (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      value={customInterval}
                      onChange={(e) => setCustomInterval(parseInt(e.target.value) || 60)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                    />
                  </div>
                )}
                
                <p className="text-xs text-slate-500 mt-2">
                  {pipelineFrequency === 'once' 
                    ? 'One-time scrapes run immediately and don\'t repeat.'
                    : `Pipelines will check for updates ${pipelineFrequency === 'custom' ? `every ${customInterval} minutes` : pipelineFrequency}.`
                  }
                </p>
              </div>

              {/* Quick create from presets */}
              <div className="p-4 bg-slate-900 rounded-lg">
                <label className="block text-sm font-medium mb-3">Create Pipeline from Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(preset => {
                    const info = PRESET_INFO[preset] || { icon: BookOpen, color: 'text-slate-400' }
                    const Icon = info.icon
                    return (
                      <button
                        key={preset}
                        onClick={() => handlePresetScrape(preset, true)}
                        disabled={isLoading}
                        className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left disabled:opacity-50"
                      >
                        <Icon className={`w-4 h-4 ${info.color}`} />
                        <span className="capitalize text-sm">{preset}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Existing pipelines */}
              {pipelines.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-300">Active Pipelines</h4>
                  {pipelines.map(pipeline => (
                    <div key={pipeline.id} className="p-4 bg-slate-900 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pipeline.enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
                          <span className="font-medium">{pipeline.name}</span>
                          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {pipeline.frequency}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRunPipeline(pipeline.id)}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Run now"
                          >
                            <Play className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            onClick={() => handleTogglePipeline(pipeline.id, pipeline.enabled)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title={pipeline.enabled ? 'Pause' : 'Resume'}
                          >
                            {pipeline.enabled ? (
                              <Pause className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Play className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeletePipeline(pipeline.id)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="truncate block">{pipeline.url}</span>
                        {pipeline.last_run && (
                          <span className="block mt-1">
                            Last run: {new Date(pipeline.last_run).toLocaleString()}
                            {pipeline.last_run_stats && (
                              <span className="ml-2 text-slate-400">
                                (+{pipeline.last_run_stats.added} ~{pipeline.last_run_stats.updated} -{pipeline.last_run_stats.deleted})
                              </span>
                            )}
                          </span>
                        )}
                        {pipeline.next_run && (
                          <span className="block">Next run: {new Date(pipeline.next_run).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pipelines.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No pipelines configured yet.</p>
                  <p className="text-sm">Create one from a preset above or use the Crawl tab.</p>
                </div>
              )}

              <div className="mt-4 p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
                <h4 className="font-medium text-amber-300 mb-2">How Incremental Updates Work</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Each document's content is hashed when first scraped</li>
                  <li>• On subsequent runs, only changed documents are re-indexed</li>
                  <li>• Deleted pages are automatically removed from the knowledge base</li>
                  <li>• Stats show: <span className="text-green-400">+added</span> <span className="text-amber-400">~updated</span> <span className="text-red-400">-deleted</span></li>
                </ul>
              </div>
            </div>
          )}

          {/* Crawl Tab */}
          {activeTab === 'crawl' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Website URL</label>
                <input
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://docs.example.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crawlRecursive}
                    onChange={(e) => setCrawlRecursive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">Crawl recursively (follow links)</span>
                </label>
              </div>

              {crawlRecursive && (
                <div>
                  <label className="block text-sm font-medium mb-2">Max Depth: {crawlDepth}</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={crawlDepth}
                    onChange={(e) => setCrawlDepth(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Higher depth = more pages crawled, but takes longer
                  </p>
                </div>
              )}

              {/* Advanced Options */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                <Settings className="w-4 h-4" />
                Advanced Options
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 bg-slate-900/50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Pages: {crawlMaxPages}</label>
                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={crawlMaxPages}
                      onChange={(e) => setCrawlMaxPages(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>100</span>
                      <span>10,000</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Platform Detection</label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="confluence">Confluence</option>
                      <option value="sharepoint">SharePoint</option>
                      <option value="gitbook">GitBook</option>
                      <option value="docusaurus">Docusaurus</option>
                      <option value="mkdocs">MkDocs</option>
                      <option value="sphinx">Sphinx</option>
                      <option value="generic">Generic</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Platform-specific extraction for better content quality
                    </p>
                  </div>

                  {/* Authentication Section */}
                  <div className="border-t border-slate-700 pt-4">
                    <label className="block text-sm font-medium mb-3">Authentication (for internal wikis)</label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { id: 'none', label: 'None' },
                        { id: 'bearer', label: 'Bearer Token' },
                        { id: 'basic', label: 'Basic Auth' },
                        { id: 'cookie', label: 'Session Cookie' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setAuthMethod(opt.id)}
                          className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                            authMethod === opt.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {authMethod === 'bearer' && (
                      <div>
                        <input
                          type="password"
                          value={authToken}
                          onChange={(e) => setAuthToken(e.target.value)}
                          placeholder="Bearer token or API key"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Token will be sent as: Authorization: Bearer &lt;token&gt;
                        </p>
                      </div>
                    )}

                    {authMethod === 'basic' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={basicUsername}
                          onChange={(e) => setBasicUsername(e.target.value)}
                          placeholder="Username or service account"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                        />
                        <input
                          type="password"
                          value={basicPassword}
                          onChange={(e) => setBasicPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                        />
                        <p className="text-xs text-slate-500">
                          For wikis using HTTP Basic Authentication
                        </p>
                      </div>
                    )}

                    {authMethod === 'cookie' && (
                      <div>
                        <textarea
                          value={cookieString}
                          onChange={(e) => setCookieString(e.target.value)}
                          placeholder="Paste cookies from browser dev tools (F12 → Network → Copy as cURL → extract cookies)&#10;&#10;Example: session_id=abc123; auth_token=xyz789"
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg font-mono text-xs"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          <strong>How to get cookies:</strong> Log into the wiki → F12 → Network tab → Refresh → Click any request → Copy "Cookie" header value
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-400">
                <p className="font-medium text-white mb-2">Supported Platforms:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Confluence</strong> - Atlassian wiki spaces</li>
                  <li><strong>SharePoint</strong> - Microsoft documentation</li>
                  <li><strong>GitBook, Docusaurus, MkDocs, Sphinx</strong> - Common doc platforms</li>
                  <li><strong>Any website</strong> - Generic content extraction</li>
                </ul>
              </div>

              {/* Crawl Status */}
              {(crawlStatus || isLoading) && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span className="font-medium capitalize">{crawlStatus?.status || 'starting'}</span>
                    </div>
                    {isLoading && crawlStatus?.status !== 'cancelling' && crawlStatus?.status !== 'completed' && (
                      <button
                        onClick={cancelCrawl}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Pages processed:</span>
                      <span className="text-white">{crawlStatus.pages_processed || 0}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Pages found:</span>
                      <span className="text-white">{crawlStatus.pages_found || 0}</span>
                    </div>
                    {crawlStatus.documents_indexed > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Documents indexed:</span>
                        <span className="text-green-400">{crawlStatus.documents_indexed}</span>
                      </div>
                    )}
                    {crawlStatus.current_page && (
                      <div className="pt-2 border-t border-slate-700">
                        <span className="text-slate-500 text-xs">Current: </span>
                        <span className="text-xs text-slate-400 break-all">{crawlStatus.current_page}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleCrawl}
                disabled={isLoading || !crawlUrl.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                {isLoading ? 'Crawling...' : 'Start Crawling'}
              </button>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <p className="text-lg font-medium mb-2">Drop files here</p>
                <p className="text-sm text-slate-400 mb-4">or click to browse</p>
                <input
                  type="file"
                  multiple
                  accept=".md,.txt,.html,.htm,.rst,.json"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse Files
                </label>
                <p className="text-xs text-slate-500 mt-4">
                  Supported: .md, .txt, .html, .rst, .json
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{uploadedFiles.length} file(s) selected:</p>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={uploadFiles}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isLoading ? 'Uploading...' : 'Upload & Index Files'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Source Name (optional)</label>
                <input
                  type="text"
                  value={textSourceName}
                  onChange={(e) => setTextSourceName(e.target.value)}
                  placeholder="e.g., Internal Runbook, FAQ, etc."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste your documentation, FAQ, runbook, or any text content here..."
                  rows={10}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                onClick={handleTextSubmit}
                disabled={isLoading || !textContent.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {isLoading ? 'Processing...' : 'Add to Knowledge Base'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={exportData}
                disabled={isLoading || docCount === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
              <label className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      importData(e.target.files[0], false)
                      e.target.value = ''
                    }
                  }}
                />
              </label>
            </div>
            <button
              onClick={fetchDocCount}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Count
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={clearAllDocuments}
              disabled={isLoading || docCount === 0}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Clear All Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
