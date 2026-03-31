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
                <svg id="topology-svg" viewBox="0 0 950 380" className="w-full h-auto" style={{ minHeight: '350px' }}>
                  {/* Background */}
                  <rect width="950" height="380" fill="#0f172a" />
                  
                  {/* Arrowhead marker definition */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>
                    <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
                    </marker>
                  </defs>
                  
                  {/* Title */}
                  <text x="475" y="25" textAnchor="middle" fill="#f8fafc" fontSize="16" fontWeight="bold">
                    RAG Pipeline Architecture
                  </text>
                  
                  {/* ===== TOP ROW: Main Query Flow ===== */}
                  
                  {/* User Query Box */}
                  <g transform="translate(20, 50)">
                    <rect width="100" height="70" rx="10" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="2" />
                    <text x="50" y="22" textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="bold">USER</text>
                    <line x1="10" y1="30" x2="90" y2="30" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
                    <text x="50" y="48" textAnchor="middle" fill="#f8fafc" fontSize="10">Query</text>
                    <text x="50" y="62" textAnchor="middle" fill="#64748b" fontSize="8">Natural Language</text>
                  </g>
                  
                  {/* Arrow: User -> Vector Store */}
                  <line x1="120" y1="85" x2="175" y2="85" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
                  <text x="147" y="78" textAnchor="middle" fill="#06b6d4" fontSize="9">Search</text>
                  
                  {/* Vector Store Box */}
                  <g transform="translate(180, 45)">
                    <rect width="150" height="80" rx="10" fill="#1e3a5f" stroke="#8b5cf6" strokeWidth="2" />
                    <text x="75" y="20" textAnchor="middle" fill="#8b5cf6" fontSize="11" fontWeight="bold">VECTOR STORE</text>
                    <line x1="10" y1="28" x2="140" y2="28" stroke="#8b5cf6" strokeWidth="1" opacity="0.4" />
                    <text x="75" y="45" textAnchor="middle" fill="#f8fafc" fontSize="11">ChromaDB</text>
                    <text x="75" y="60" textAnchor="middle" fill="#94a3b8" fontSize="9">{config?.documents_count?.toLocaleString() || 0} chunks</text>
                    <text x="75" y="73" textAnchor="middle" fill="#64748b" fontSize="8">Chunk: {config?.chunk_size || 1000}</text>
                  </g>
                  
                  {/* Arrow: Vector Store -> LLM */}
                  <line x1="330" y1="85" x2="385" y2="85" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="357" y="78" textAnchor="middle" fill="#64748b" fontSize="9">Context</text>
                  
                  {/* LLM Box */}
                  <g transform="translate(390, 45)">
                    <rect width="160" height="80" rx="10" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="2" />
                    <text x="80" y="20" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold">LLM</text>
                    <line x1="10" y1="28" x2="150" y2="28" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />
                    <text x="80" y="45" textAnchor="middle" fill="#f8fafc" fontSize="10">{config?.ollama_model || 'Not configured'}</text>
                    <text x="80" y="60" textAnchor="middle" fill="#94a3b8" fontSize="9">via Ollama</text>
                    <text x="80" y="73" textAnchor="middle" fill={config?.services?.ollama?.healthy ? '#10b981' : '#ef4444'} fontSize="9">
                      {config?.services?.ollama?.healthy ? '● Connected' : '○ Disconnected'}
                    </text>
                  </g>
                  
                  {/* Arrow: LLM -> Response */}
                  <line x1="550" y1="85" x2="605" y2="85" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="577" y="78" textAnchor="middle" fill="#64748b" fontSize="9">Generate</text>
                  
                  {/* Response Box */}
                  <g transform="translate(610, 50)">
                    <rect width="100" height="70" rx="10" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="2" />
                    <text x="50" y="22" textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="bold">RESPONSE</text>
                    <line x1="10" y1="30" x2="90" y2="30" stroke="#06b6d4" strokeWidth="1" opacity="0.4" />
                    <text x="50" y="48" textAnchor="middle" fill="#f8fafc" fontSize="10">with sources</text>
                    <text x="50" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9">Top-K: {config?.top_k || 5}</text>
                  </g>
                  
                  {/* ===== BOTTOM ROW: Supporting Components ===== */}
                  
                  {/* Data Sources Box - aligned left */}
                  <g transform="translate(20, 155)">
                    <rect width="130" height="100" rx="10" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
                    <text x="65" y="20" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">DATA SOURCES</text>
                    <line x1="10" y1="28" x2="120" y2="28" stroke="#3b82f6" strokeWidth="1" opacity="0.4" />
                    
                    {Object.entries(docsByType).slice(0, 3).map(([type, docs], i) => (
                      <g key={type} transform={`translate(10, ${40 + i * 16})`}>
                        <circle cx="6" cy="5" r="3" fill="#3b82f6" />
                        <text x="14" y="8" fill="#94a3b8" fontSize="9">{type}: {docs.length}</text>
                      </g>
                    ))}
                    
                    <text x="65" y="92" textAnchor="middle" fill="#64748b" fontSize="8">{documents.length} total sources</text>
                  </g>
                  
                  {/* Arrow: Data Sources -> Vector Store (diagonal) */}
                  <path d="M 150 190 L 220 190 L 220 130" fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="185" y="183" textAnchor="middle" fill="#64748b" fontSize="9">Index</text>
                  
                  {/* Embeddings Box - centered under Vector Store */}
                  <g transform="translate(180, 155)">
                    <rect width="150" height="100" rx="10" fill="#1e3a5f" stroke="#10b981" strokeWidth="2" />
                    <text x="75" y="20" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold">EMBEDDINGS</text>
                    <line x1="10" y1="28" x2="140" y2="28" stroke="#10b981" strokeWidth="1" opacity="0.4" />
                    <text x="75" y="48" textAnchor="middle" fill="#f8fafc" fontSize="9">{config?.embedding_model?.split('/').pop() || 'Unknown'}</text>
                    <text x="75" y="65" textAnchor="middle" fill="#94a3b8" fontSize="9">{config?.services?.embeddings?.healthy ? '● Ready' : '○ Not Ready'}</text>
                    <text x="75" y="85" textAnchor="middle" fill="#64748b" fontSize="8">Text → Vectors</text>
                  </g>
                  
                  {/* Arrow: Embeddings -> Vector Store */}
                  <line x1="255" y1="155" x2="255" y2="130" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="270" y="145" fill="#64748b" fontSize="9">Embed</text>
                  
                  {/* Persona Box - centered under LLM */}
                  <g transform="translate(390, 155)">
                    <rect width="160" height="100" rx="10" fill="#1e3a5f" stroke="#ec4899" strokeWidth="2" />
                    <text x="80" y="20" textAnchor="middle" fill="#ec4899" fontSize="11" fontWeight="bold">PERSONA</text>
                    <line x1="10" y1="28" x2="150" y2="28" stroke="#ec4899" strokeWidth="1" opacity="0.4" />
                    <text x="80" y="48" textAnchor="middle" fill="#f8fafc" fontSize="10">{persona?.name || 'Default Assistant'}</text>
                    <text x="80" y="65" textAnchor="middle" fill="#94a3b8" fontSize="9">System prompt</text>
                    <text x="80" y="85" textAnchor="middle" fill="#64748b" fontSize="8">Defines AI behavior</text>
                  </g>
                  
                  {/* Arrow: Persona -> LLM */}
                  <line x1="470" y1="155" x2="470" y2="130" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x="485" y="145" fill="#64748b" fontSize="9">Prompt</text>
                  
                  {/* GPU Info Box (if available) - aligned with Response */}
                  {config?.gpu?.available && (
                    <g transform="translate(610, 155)">
                      <rect width="100" height="100" rx="10" fill="#1e3a5f" stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="50" y="20" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">GPU</text>
                      <line x1="10" y1="28" x2="90" y2="28" stroke="#64748b" strokeWidth="1" opacity="0.4" />
                      <text x="50" y="50" textAnchor="middle" fill="#f8fafc" fontSize="8">{config.gpu.name?.slice(0, 12) || 'Available'}</text>
                      <text x="50" y="70" textAnchor="middle" fill="#10b981" fontSize="9">● Active</text>
                    </g>
                  )}
                  
                  {/* Legend */}
                  <g transform="translate(20, 300)">
                    <text x="0" y="0" fill="#64748b" fontSize="10" fontWeight="bold">Legend:</text>
                    
                    <rect x="60" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#06b6d4" strokeWidth="1" />
                    <text x="75" y="0" fill="#64748b" fontSize="9">User/Response</text>
                    
                    <rect x="160" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#8b5cf6" strokeWidth="1" />
                    <text x="175" y="0" fill="#64748b" fontSize="9">Storage</text>
                    
                    <rect x="230" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="1" />
                    <text x="245" y="0" fill="#64748b" fontSize="9">AI Model</text>
                    
                    <rect x="300" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
                    <text x="315" y="0" fill="#64748b" fontSize="9">Data</text>
                    
                    <rect x="355" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#10b981" strokeWidth="1" />
                    <text x="370" y="0" fill="#64748b" fontSize="9">Processing</text>
                    
                    <rect x="440" y="-9" width="10" height="10" rx="2" fill="#1e3a5f" stroke="#ec4899" strokeWidth="1" />
                    <text x="455" y="0" fill="#64748b" fontSize="9">Config</text>
                  </g>
                  
                  {/* Flow description */}
                  <text x="475" y="340" textAnchor="middle" fill="#475569" fontSize="9">
                    Flow: User Query → Vector Search → Context Retrieval → LLM Generation → Response with Sources
                  </text>
                  
                  {/* Timestamp */}
                  <text x="930" y="370" textAnchor="end" fill="#475569" fontSize="8">
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
