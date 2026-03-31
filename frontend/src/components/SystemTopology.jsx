import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X, Download, FileImage, FileCode, RefreshCw, 
  Database, Brain, FileText, Globe, Server, 
  ArrowRight, Cpu, HardDrive, Zap
} from 'lucide-react'

const API_BASE = '/api'

export default function SystemTopology({ onClose }) {
  const [config, setConfig] = useState(null)
  const [documents, setDocuments] = useState([])
  const [persona, setPersona] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const canvasRef = useRef(null)

  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const [settingsRes, healthRes, docsRes, personaRes, monitorRes] = await Promise.all([
        fetch(`${API_BASE}/settings`),
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/documents/list`),
        fetch(`${API_BASE}/persona`),
        fetch(`${API_BASE}/monitor/status`)
      ])
      
      const settings = await settingsRes.json()
      const health = await healthRes.json()
      const docs = await docsRes.json()
      const personaData = await personaRes.json()
      const monitor = await monitorRes.json()
      
      // Build services status from both health and monitor endpoints
      const services = monitor.services || {}
      
      // Use health endpoint as primary source for status
      if (health.ollama_status) {
        services.ollama = {
          ...services.ollama,
          status: health.ollama_status,
          healthy: health.ollama_status === 'connected'
        }
      }
      if (health.vector_store_status) {
        services.vector_store = {
          ...services.vector_store,
          status: health.vector_store_status,
          healthy: health.vector_store_status === 'connected',
          document_count: health.documents_count
        }
      }
      // Embeddings are always ready if we got this far
      services.embeddings = {
        ...services.embeddings,
        status: 'ready',
        healthy: true,
        model: settings.embedding_model
      }
      
      setConfig({
        ...settings,
        ...health,
        services,
        gpu: monitor.gpu
      })
      setDocuments(docs.documents || [])
      setPersona(personaData)
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const exportToPNG = () => {
    const svg = document.getElementById('topology-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `rag-topology-${new Date().toISOString().slice(0,10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const exportToDrawIO = () => {
    const nodes = []
    const edges = []
    let nodeId = 1
    
    // Create draw.io XML structure
    const createNode = (id, label, x, y, width, height, style) => {
      return `<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
      </mxCell>`
    }
    
    const createEdge = (id, source, target, label = '') => {
      return `<mxCell id="${id}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#94a3b8;strokeWidth=2;" edge="1" parent="1" source="${source}" target="${target}">
        <mxGeometry relative="1" as="geometry"/>
      </mxCell>`
    }

    // Data Sources node
    const dataSources = documents.slice(0, 5).map(d => d.source.split('/').pop()).join('\\n')
    nodes.push(createNode(2, `Data Sources\\n${documents.length} sources`, 50, 150, 160, 100, 
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#3b82f6;fontColor=#ffffff;'))
    
    // Vector Store node
    nodes.push(createNode(3, `Vector Store\\nChromaDB\\n${config?.documents_count || 0} chunks`, 280, 150, 160, 100,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#8b5cf6;fontColor=#ffffff;'))
    
    // Embeddings node
    nodes.push(createNode(4, `Embeddings\\n${config?.embedding_model || 'Unknown'}`, 280, 300, 160, 80,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#10b981;fontColor=#ffffff;'))
    
    // LLM node
    nodes.push(createNode(5, `LLM\\n${config?.ollama_model || 'Unknown'}\\nOllama`, 510, 150, 160, 100,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#f59e0b;fontColor=#ffffff;'))
    
    // Persona node
    nodes.push(createNode(6, `Persona\\n${persona?.name || 'Default'}`, 510, 300, 160, 80,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#ec4899;fontColor=#ffffff;'))
    
    // User node
    nodes.push(createNode(7, 'User Query', 740, 150, 120, 60,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#06b6d4;fontColor=#ffffff;'))
    
    // Response node
    nodes.push(createNode(8, 'Response', 740, 240, 120, 60,
      'rounded=1;whiteSpace=wrap;html=1;fillColor=#1e3a5f;strokeColor=#06b6d4;fontColor=#ffffff;'))
    
    // Edges
    edges.push(createEdge(10, 2, 3, 'Index'))
    edges.push(createEdge(11, 4, 3, 'Embed'))
    edges.push(createEdge(12, 3, 5, 'Context'))
    edges.push(createEdge(13, 6, 5, 'Prompt'))
    edges.push(createEdge(14, 7, 3, 'Search'))
    edges.push(createEdge(15, 5, 8, 'Generate'))

    const drawioXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="RAG Assistant Export" version="21.0.0">
  <diagram name="RAG Pipeline" id="rag-topology">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="900" pageHeight="500" background="#0f172a">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${nodes.join('\n        ')}
        ${edges.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`

    const blob = new Blob([drawioXml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rag-topology-${new Date().toISOString().slice(0,10)}.drawio`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group documents by type
  const docsByType = documents.reduce((acc, doc) => {
    const type = doc.type || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(doc)
    return acc
  }, {})

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">System Topology</h2>
              <p className="text-sm text-slate-400">RAG Pipeline Configuration & Data Flow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchConfig}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportToPNG}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              <FileImage className="w-4 h-4" />
              Export PNG
            </button>
            <button
              onClick={exportToDrawIO}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
            >
              <FileCode className="w-4 h-4" />
              Export draw.io
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* SVG Topology Diagram */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <svg id="topology-svg" viewBox="0 0 900 400" className="w-full h-auto" style={{ minHeight: '350px' }}>
                  {/* Background */}
                  <rect width="900" height="400" fill="#0f172a" />
                  
                  {/* Title */}
                  <text x="450" y="30" textAnchor="middle" fill="#f8fafc" fontSize="18" fontWeight="bold">
                    RAG Pipeline Architecture
                  </text>
                  
                  {/* Data Sources Box */}
                  <g transform="translate(30, 60)">
                    <rect width="180" height="140" rx="12" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
                    <text x="90" y="25" textAnchor="middle" fill="#3b82f6" fontSize="12" fontWeight="bold">DATA SOURCES</text>
                    <line x1="20" y1="35" x2="160" y2="35" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
                    
                    {Object.entries(docsByType).slice(0, 4).map(([type, docs], i) => (
                      <g key={type} transform={`translate(15, ${50 + i * 22})`}>
                        <circle cx="8" cy="6" r="4" fill="#3b82f6" />
                        <text x="18" y="10" fill="#94a3b8" fontSize="11">
                          {type}: {docs.length} sources
                        </text>
                      </g>
                    ))}
                    
                    <text x="90" y="130" textAnchor="middle" fill="#64748b" fontSize="10">
                      {documents.length} total sources
                    </text>
                  </g>
                  
                  {/* Arrow: Data Sources -> Vector Store */}
                  <g>
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                      </marker>
                    </defs>
                    <line x1="210" y1="130" x2="270" y2="130" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    <text x="240" y="120" textAnchor="middle" fill="#64748b" fontSize="10">Index</text>
                  </g>
                  
                  {/* Vector Store Box */}
                  <g transform="translate(280, 60)">
                    <rect width="180" height="140" rx="12" fill="#1e3a5f" stroke="#8b5cf6" strokeWidth="2" />
                    <text x="90" y="25" textAnchor="middle" fill="#8b5cf6" fontSize="12" fontWeight="bold">VECTOR STORE</text>
                    <line x1="20" y1="35" x2="160" y2="35" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
                    
                    <text x="90" y="60" textAnchor="middle" fill="#f8fafc" fontSize="13">ChromaDB</text>
                    <text x="90" y="85" textAnchor="middle" fill="#94a3b8" fontSize="11">
                      {config?.documents_count?.toLocaleString() || 0} chunks
                    </text>
                    <text x="90" y="105" textAnchor="middle" fill="#94a3b8" fontSize="11">
                      {totalChunks.toLocaleString()} indexed
                    </text>
                    
                    <text x="90" y="130" textAnchor="middle" fill="#64748b" fontSize="10">
                      Chunk: {config?.chunk_size || 1000} / Overlap: {config?.chunk_overlap || 200}
                    </text>
                  </g>
                  
                  {/* Arrow: Vector Store -> LLM */}
                  <line x1="460" y1="130" x2="520" y2="130" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="490" y="120" textAnchor="middle" fill="#64748b" fontSize="10">Context</text>
                  
                  {/* LLM Box */}
                  <g transform="translate(530, 60)">
                    <rect width="180" height="140" rx="12" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="2" />
                    <text x="90" y="25" textAnchor="middle" fill="#f59e0b" fontSize="12" fontWeight="bold">LLM</text>
                    <line x1="20" y1="35" x2="160" y2="35" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
                    
                    <text x="90" y="60" textAnchor="middle" fill="#f8fafc" fontSize="13">
                      {config?.ollama_model || 'Not configured'}
                    </text>
                    <text x="90" y="85" textAnchor="middle" fill="#94a3b8" fontSize="11">
                      via Ollama
                    </text>
                    <text x="90" y="105" textAnchor="middle" fill={config?.services?.ollama?.healthy ? '#10b981' : '#ef4444'} fontSize="11">
                      {config?.services?.ollama?.healthy ? '● Connected' : '○ Disconnected'}
                    </text>
                    
                    {config?.gpu?.available && (
                      <text x="90" y="130" textAnchor="middle" fill="#64748b" fontSize="10">
                        GPU: {config.gpu.name?.slice(0, 20) || 'Available'}
                      </text>
                    )}
                  </g>
                  
                  {/* Arrow: LLM -> Response */}
                  <line x1="710" y1="130" x2="770" y2="130" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="740" y="120" textAnchor="middle" fill="#64748b" fontSize="10">Generate</text>
                  
                  {/* Response Box */}
                  <g transform="translate(780, 90)">
                    <rect width="100" height="80" rx="12" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="2" />
                    <text x="50" y="35" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="bold">RESPONSE</text>
                    <text x="50" y="55" textAnchor="middle" fill="#94a3b8" fontSize="10">with sources</text>
                    <text x="50" y="70" textAnchor="middle" fill="#94a3b8" fontSize="10">Top-K: {config?.top_k || 5}</text>
                  </g>
                  
                  {/* Embeddings Box */}
                  <g transform="translate(280, 230)">
                    <rect width="180" height="80" rx="12" fill="#1e3a5f" stroke="#10b981" strokeWidth="2" />
                    <text x="90" y="25" textAnchor="middle" fill="#10b981" fontSize="12" fontWeight="bold">EMBEDDINGS</text>
                    <line x1="20" y1="35" x2="160" y2="35" stroke="#10b981" strokeWidth="1" opacity="0.5" />
                    
                    <text x="90" y="55" textAnchor="middle" fill="#f8fafc" fontSize="10">
                      {config?.embedding_model?.split('/').pop() || 'Unknown'}
                    </text>
                    <text x="90" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9">
                      {config?.services?.embeddings?.healthy ? '● Ready' : '○ Not Ready'}
                    </text>
                  </g>
                  
                  {/* Arrow: Embeddings -> Vector Store */}
                  <line x1="370" y1="230" x2="370" y2="205" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="385" y="220" fill="#64748b" fontSize="10">Embed</text>
                  
                  {/* Persona Box */}
                  <g transform="translate(530, 230)">
                    <rect width="180" height="80" rx="12" fill="#1e3a5f" stroke="#ec4899" strokeWidth="2" />
                    <text x="90" y="25" textAnchor="middle" fill="#ec4899" fontSize="12" fontWeight="bold">PERSONA</text>
                    <line x1="20" y1="35" x2="160" y2="35" stroke="#ec4899" strokeWidth="1" opacity="0.5" />
                    
                    <text x="90" y="55" textAnchor="middle" fill="#f8fafc" fontSize="11">
                      {persona?.name || 'Default Assistant'}
                    </text>
                    <text x="90" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9">
                      Custom system prompt
                    </text>
                  </g>
                  
                  {/* Arrow: Persona -> LLM */}
                  <line x1="620" y1="230" x2="620" y2="205" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="635" y="220" fill="#64748b" fontSize="10">Prompt</text>
                  
                  {/* User Query - positioned on the left */}
                  <g transform="translate(30, 240)">
                    <rect width="100" height="70" rx="12" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="2" strokeDasharray="5,5" />
                    <text x="50" y="25" textAnchor="middle" fill="#06b6d4" fontSize="12" fontWeight="bold">USER</text>
                    <text x="50" y="45" textAnchor="middle" fill="#94a3b8" fontSize="10">Query Input</text>
                    <text x="50" y="60" textAnchor="middle" fill="#64748b" fontSize="9">Natural Language</text>
                  </g>
                  
                  {/* Arrow: User -> Vector Store (search) */}
                  <path d="M 130 275 L 200 275 L 200 130 L 270 130" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
                  <text x="165" y="200" fill="#06b6d4" fontSize="10">Search</text>
                  
                  {/* Legend */}
                  <g transform="translate(30, 340)">
                    <text x="0" y="0" fill="#64748b" fontSize="10">Legend:</text>
                    <rect x="50" y="-10" width="12" height="12" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
                    <text x="67" y="0" fill="#64748b" fontSize="9">Data</text>
                    <rect x="100" y="-10" width="12" height="12" rx="2" fill="#1e3a5f" stroke="#8b5cf6" strokeWidth="1" />
                    <text x="117" y="0" fill="#64748b" fontSize="9">Storage</text>
                    <rect x="160" y="-10" width="12" height="12" rx="2" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="1" />
                    <text x="177" y="0" fill="#64748b" fontSize="9">AI</text>
                    <rect x="200" y="-10" width="12" height="12" rx="2" fill="#1e3a5f" stroke="#10b981" strokeWidth="1" />
                    <text x="217" y="0" fill="#64748b" fontSize="9">Processing</text>
                    <rect x="275" y="-10" width="12" height="12" rx="2" fill="#1e3a5f" stroke="#ec4899" strokeWidth="1" />
                    <text x="292" y="0" fill="#64748b" fontSize="9">Config</text>
                  </g>
                  
                  {/* Timestamp */}
                  <text x="870" y="390" textAnchor="end" fill="#475569" fontSize="9">
                    Generated: {new Date().toLocaleString()}
                  </text>
                </svg>
              </div>

              {/* Configuration Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Data Sources Summary */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-5 h-5 text-blue-400" />
                    <h3 className="font-semibold text-white">Data Sources</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    {Object.entries(docsByType).map(([type, docs]) => (
                      <div key={type} className="flex justify-between text-slate-300">
                        <span className="capitalize">{type}</span>
                        <span className="text-slate-400">{docs.length} sources, {docs.reduce((s, d) => s + (d.chunk_count || 0), 0)} chunks</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between font-medium">
                      <span>Total</span>
                      <span>{documents.length} sources, {totalChunks} chunks</span>
                    </div>
                  </div>
                </div>

                {/* Model Configuration */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Model Configuration</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>LLM</span>
                      <span className="text-slate-400">{config?.ollama_model || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Embeddings</span>
                      <span className="text-slate-400 text-xs">{config?.embedding_model?.split('/').pop() || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Top-K Results</span>
                      <span className="text-slate-400">{config?.top_k || 5}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Chunk Size</span>
                      <span className="text-slate-400">{config?.chunk_size || 1000}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Chunk Overlap</span>
                      <span className="text-slate-400">{config?.chunk_overlap || 200}</span>
                    </div>
                  </div>
                </div>

                {/* System Status */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-white">System Status</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>Ollama</span>
                      <span className={config?.services?.ollama?.healthy ? 'text-green-400' : 'text-red-400'}>
                        {config?.services?.ollama?.healthy ? '● Connected' : '○ Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Vector Store</span>
                      <span className={config?.services?.vector_store?.healthy ? 'text-green-400' : 'text-red-400'}>
                        {config?.services?.vector_store?.healthy ? '● Connected' : '○ Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Embeddings</span>
                      <span className={config?.services?.embeddings?.healthy ? 'text-green-400' : 'text-red-400'}>
                        {config?.services?.embeddings?.healthy ? '● Ready' : '○ Not Ready'}
                      </span>
                    </div>
                    {config?.gpu?.available && (
                      <div className="flex justify-between text-slate-300">
                        <span>GPU</span>
                        <span className="text-green-400">● {config.gpu.name?.slice(0, 15) || 'Available'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Data Sources */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Top Data Sources</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {documents.slice(0, 9).map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg text-sm">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-300 truncate flex-1" title={doc.source}>
                        {doc.source.split('/').pop() || doc.source}
                      </span>
                      <span className="text-slate-500 text-xs">{doc.chunk_count} chunks</span>
                    </div>
                  ))}
                </div>
                {documents.length > 9 && (
                  <p className="text-slate-500 text-sm mt-2">+ {documents.length - 9} more sources</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
