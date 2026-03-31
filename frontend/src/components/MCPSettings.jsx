import { useState, useEffect } from 'react'
import { 
  X, Plug, Copy, Check, AlertCircle, CheckCircle, 
  Terminal, Settings, ExternalLink, RefreshCw, Download
} from 'lucide-react'

const API_BASE = '/api'

export default function MCPSettings({ isOpen, onClose }) {
  const [mcpStatus, setMcpStatus] = useState(null)
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchMCPStatus()
    }
  }, [isOpen])

  const fetchMCPStatus = async () => {
    setIsLoading(true)
    try {
      const [statusRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/mcp/status`),
        fetch(`${API_BASE}/settings`)
      ])
      
      const statusData = await statusRes.json()
      const settingsData = await settingsRes.json()
      
      setMcpStatus(statusData)
      setSettings(settingsData)
    } catch (error) {
      console.error('Failed to fetch MCP status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMCP = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('mcp_enabled', !settings.mcp_enabled)
      
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        body: formData
      })
      
      setSettings(prev => ({ ...prev, mcp_enabled: !prev.mcp_enabled }))
    } catch (error) {
      console.error('Failed to toggle MCP:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyConfig = () => {
    if (mcpStatus?.claude_desktop_config) {
      navigator.clipboard.writeText(JSON.stringify(mcpStatus.claude_desktop_config, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadConfig = () => {
    if (mcpStatus?.claude_desktop_config) {
      const blob = new Blob([JSON.stringify(mcpStatus.claude_desktop_config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mcp-config.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <Plug className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">MCP Integration</h2>
              <p className="text-sm text-slate-400">Model Context Protocol for AI Assistants</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Enable/Disable Toggle */}
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Enable MCP Server</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Allow AI assistants like Claude Desktop to access your knowledge base
                    </p>
                  </div>
                  <button
                    onClick={toggleMCP}
                    disabled={saving}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      settings?.mcp_enabled ? 'bg-purple-600' : 'bg-slate-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      settings?.mcp_enabled ? 'translate-x-8' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {mcpStatus?.mcp_installed ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-sm font-medium">MCP SDK</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {mcpStatus?.mcp_installed ? 'Installed' : 'Not installed - run: pip install mcp'}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {mcpStatus?.mcp_server_exists ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium">MCP Server</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {mcpStatus?.mcp_server_exists ? 'Ready' : 'Server file not found'}
                  </p>
                </div>
              </div>

              {/* Configuration Section */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuration for Claude Desktop / Cursor / Windsurf
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Add this configuration to your AI assistant's config file:
                </p>
                
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 text-xs overflow-x-auto border border-slate-700">
                    {JSON.stringify(mcpStatus?.claude_desktop_config, null, 2)}
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={copyConfig}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={downloadConfig}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                      title="Download config file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400">
                    <strong>Config file locations:</strong>
                  </p>
                  <ul className="text-xs text-slate-500 mt-2 space-y-1">
                    <li>• <strong>Claude Desktop (macOS):</strong> ~/Library/Application Support/Claude/claude_desktop_config.json</li>
                    <li>• <strong>Claude Desktop (Windows):</strong> %APPDATA%\Claude\claude_desktop_config.json</li>
                    <li>• <strong>Cursor:</strong> Settings → Features → MCP Servers</li>
                    <li>• <strong>Windsurf:</strong> Settings → MCP Configuration</li>
                  </ul>
                </div>
              </div>

              {/* Available Tools */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Available MCP Tools ({mcpStatus?.available_tools?.length || 0})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {mcpStatus?.available_tools?.map((tool, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-slate-900 rounded text-xs font-mono text-purple-400"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Server Path */}
              {mcpStatus?.mcp_server_path && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="font-medium mb-2 text-sm">MCP Server Path</h3>
                  <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded block overflow-x-auto">
                    {mcpStatus.mcp_server_path}
                  </code>
                </div>
              )}

              {/* Help Section */}
              <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-purple-300">How to Use</h3>
                <ol className="text-sm text-slate-300 space-y-2">
                  <li>1. Enable MCP above</li>
                  <li>2. Copy the configuration JSON</li>
                  <li>3. Add it to your AI assistant's config file</li>
                  <li>4. Restart your AI assistant</li>
                  <li>5. Ask your AI to "search my knowledge base" or "ask my RAG assistant"</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center">
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
          >
            Learn more about MCP
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
