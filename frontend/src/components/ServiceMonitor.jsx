import { useState, useEffect, useCallback } from 'react'
import { 
  Activity, Server, Database, Cpu, HardDrive, MemoryStick,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2,
  Zap, Clock, RotateCcw, X, ChevronDown, ChevronUp,
  Gauge, Thermometer, Box
} from 'lucide-react'

const API_BASE = '/api'

function StatusBadge({ healthy, status }) {
  if (healthy) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
        <CheckCircle className="w-3 h-3" />
        {status || 'Healthy'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded">
      <XCircle className="w-3 h-3" />
      {status || 'Error'}
    </span>
  )
}

function ProgressBar({ percent, color = 'indigo', size = 'md' }) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2'
  const bgColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : `bg-${color}-500`
  
  return (
    <div className={`w-full bg-slate-700 rounded-full ${height}`}>
      <div 
        className={`${bgColor} ${height} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

function ServiceCard({ icon: Icon, name, status, healthy, details, color = 'indigo' }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-800 text-${color}-400`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium">{name}</h4>
            <p className="text-xs text-slate-500">{status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge healthy={healthy} />
          {details && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-slate-800 rounded"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      
      {expanded && details && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-sm text-slate-400">
          {details}
        </div>
      )}
    </div>
  )
}

function ResourceGauge({ label, value, max, unit, icon: Icon }) {
  const percent = (value / max) * 100
  const color = percent > 90 ? 'text-red-400' : percent > 70 ? 'text-amber-400' : 'text-green-400'
  
  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        <span className={`text-sm font-medium ${color}`}>
          {value.toFixed(1)}{unit} / {max.toFixed(1)}{unit}
        </span>
      </div>
      <ProgressBar percent={percent} />
      <p className="text-xs text-slate-500 mt-1">{percent.toFixed(0)}% used</p>
    </div>
  )
}

export default function ServiceMonitor({ onClose }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/monitoring/status`)
      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setStatus(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [fetchStatus, autoRefresh])

  const allHealthy = status?.services && 
    Object.values(status.services).every(s => s.healthy)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${allHealthy ? 'bg-green-900/30' : 'bg-amber-900/30'}`}>
              <Activity className={`w-6 h-6 ${allHealthy ? 'text-green-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold">System Monitor</h2>
              <p className="text-sm text-slate-400">
                {allHealthy ? 'All systems operational' : 'Some services need attention'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !status ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
              <p className="font-medium">Failed to fetch system status</p>
              <p className="text-sm mt-1">{error}</p>
              <button 
                onClick={fetchStatus}
                className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm"
              >
                Retry
              </button>
            </div>
          ) : status && (
            <>
              {/* Overall Status Banner */}
              <div className={`rounded-lg p-4 ${
                allHealthy ? 'bg-green-900/20 border border-green-800' : 'bg-amber-900/20 border border-amber-800'
              }`}>
                <div className="flex items-center gap-3">
                  {allHealthy ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <p className={`font-medium ${allHealthy ? 'text-green-300' : 'text-amber-300'}`}>
                      {allHealthy ? 'All Services Running' : 'Attention Required'}
                    </p>
                    <p className="text-sm text-slate-400">
                      Last updated: {lastUpdate?.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services Grid */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Services</h3>
                <div className="grid gap-3">
                  <ServiceCard
                    icon={Server}
                    name="Backend API"
                    status={`Running on port 8000`}
                    healthy={status.services.backend.healthy}
                    color="green"
                  />
                  
                  <ServiceCard
                    icon={Zap}
                    name="Ollama LLM"
                    status={status.services.ollama.model || 'Checking...'}
                    healthy={status.services.ollama.healthy}
                    color="purple"
                    details={
                      <div className="space-y-1">
                        <p>Status: {status.services.ollama.status}</p>
                        <p>Model: {status.services.ollama.model || 'Not configured'}</p>
                        <p>Model Loaded: {status.services.ollama.model_loaded ? 'Yes' : 'No'}</p>
                      </div>
                    }
                  />
                  
                  <ServiceCard
                    icon={Database}
                    name="Vector Store (ChromaDB)"
                    status={`${status.services.vector_store.document_count.toLocaleString()} chunks indexed`}
                    healthy={status.services.vector_store.healthy}
                    color="blue"
                  />
                  
                  <ServiceCard
                    icon={Box}
                    name="Embeddings"
                    status={status.services.embeddings.model}
                    healthy={status.services.embeddings.healthy}
                    color="amber"
                  />
                </div>
              </div>

              {/* System Resources */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">System Resources</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ResourceGauge
                    label="CPU"
                    value={status.system.cpu_percent}
                    max={100}
                    unit="%"
                    icon={Cpu}
                  />
                  <ResourceGauge
                    label="Memory"
                    value={status.system.memory.used_gb}
                    max={status.system.memory.total_gb}
                    unit="GB"
                    icon={MemoryStick}
                  />
                  <ResourceGauge
                    label="Disk"
                    value={status.system.disk.used_gb}
                    max={status.system.disk.total_gb}
                    unit="GB"
                    icon={HardDrive}
                  />
                  
                  {status.gpu && (
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-400">GPU</span>
                        </div>
                        <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                          {status.gpu.name}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>VRAM</span>
                            <span>{status.gpu.memory_used_mb}MB / {status.gpu.memory_total_mb}MB</span>
                          </div>
                          <ProgressBar percent={status.gpu.memory_percent} size="sm" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Utilization</span>
                            <span>{status.gpu.utilization_percent}%</span>
                          </div>
                          <ProgressBar percent={status.gpu.utilization_percent} size="sm" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!status.gpu && (
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Gauge className="w-4 h-4" />
                        <span className="text-sm">GPU</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">No GPU detected or nvidia-smi not available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipelines Status */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Data Pipelines</h3>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{status.pipelines.total}</p>
                      <p className="text-xs text-slate-500">Total Pipelines</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">{status.pipelines.active}</p>
                      <p className="text-xs text-slate-500">Active (Scheduled)</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-400">{status.pipelines.tracked_documents}</p>
                      <p className="text-xs text-slate-500">Tracked URLs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Info */}
              <div className="text-xs text-slate-600 flex items-center justify-between">
                <span>{status.system.platform} • Python {status.system.python_version}</span>
                <span>Updated: {status.timestamp}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
