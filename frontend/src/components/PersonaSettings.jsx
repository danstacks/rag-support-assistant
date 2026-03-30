import { useState, useEffect } from 'react'
import { X, Save, RotateCcw, User, Sparkles } from 'lucide-react'

const API_BASE = '/api'

const DEFAULT_PERSONA_PREVIEW = `You are a technical expert assistant for Isovalent and Cilium technologies...`

function PersonaSettings({ isOpen, onClose }) {
  const [persona, setPersona] = useState({ name: '', prompt: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchPersona()
    }
  }, [isOpen])

  const fetchPersona = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/persona`)
      const data = await response.json()
      setPersona(data)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load persona settings' })
    } finally {
      setIsLoading(false)
    }
  }

  const savePersona = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('name', persona.name)
      formData.append('prompt', persona.prompt)
      
      const response = await fetch(`${API_BASE}/persona`, {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Persona saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save persona' })
    } finally {
      setIsSaving(false)
    }
  }

  const resetPersona = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`${API_BASE}/persona/reset`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        setPersona(data)
        setMessage({ type: 'success', text: 'Reset to default Isovalent expert persona' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reset persona' })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Assistant Persona</h2>
              <p className="text-sm text-slate-400">Customize how the assistant responds</p>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              {/* Message */}
              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.type === 'success' 
                    ? 'bg-green-900/50 text-green-300 border border-green-700' 
                    : 'bg-red-900/50 text-red-300 border border-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Persona Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Persona Name
                </label>
                <input
                  type="text"
                  value={persona.name}
                  onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                  placeholder="e.g., Isovalent Technical Expert"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  System Prompt
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Define the assistant's personality, expertise, and behavior. Use {'{context}'} where retrieved documents should be inserted.
                </p>
                <textarea
                  value={persona.prompt}
                  onChange={(e) => setPersona({ ...persona, prompt: e.target.value })}
                  rows={12}
                  placeholder="You are a technical expert..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-mono text-sm"
                />
              </div>

              {/* Tips */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Tips for effective personas:</h4>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Define the assistant's expertise and knowledge domain</li>
                  <li>• Specify how it should handle questions outside its knowledge</li>
                  <li>• Require source citations for factual claims</li>
                  <li>• Set the tone (technical, friendly, formal, etc.)</li>
                  <li>• Include {'{context}'} placeholder for retrieved documents</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={resetPersona}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={savePersona}
              disabled={isSaving || !persona.name || !persona.prompt}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Persona'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PersonaSettings
