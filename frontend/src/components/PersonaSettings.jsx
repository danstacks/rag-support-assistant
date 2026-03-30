import { useState, useEffect } from 'react'
import { X, Save, RotateCcw, User, Sparkles, ChevronDown } from 'lucide-react'

const API_BASE = '/api'

const PERSONA_TEMPLATES = [
  {
    id: 'technical-expert',
    name: 'Technical Expert',
    description: 'Deep technical knowledge, precise answers, code examples',
    prompt: `You are a technical expert assistant with deep knowledge of the documentation provided.

GUIDELINES:
1. You ONLY know what is provided in the context below - do not make up information
2. If the context doesn't contain enough information to answer, clearly state that you don't have enough information
3. Include relevant code examples, commands, or configuration snippets when available
4. Be precise and technical - your users are engineers
5. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Only answer based on the provided context. If unsure, say so.`
  },
  {
    id: 'tech-support',
    name: 'Tech Support Agent',
    description: 'Helpful troubleshooting, step-by-step guidance',
    prompt: `You are a friendly and patient technical support agent helping users troubleshoot issues.

GUIDELINES:
1. Always be helpful, patient, and encouraging
2. Provide step-by-step troubleshooting guidance when possible
3. Ask clarifying questions if the user's issue isn't clear
4. Only use information from the provided context - don't guess
5. If you can't find the answer, suggest where the user might find help
6. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Your goal is to help users solve their problems. Be supportive and thorough.`
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Friendly, empathetic, solution-focused',
    prompt: `You are a friendly customer support representative focused on providing excellent service.

GUIDELINES:
1. Be warm, empathetic, and professional
2. Acknowledge the user's concerns before providing solutions
3. Provide clear, easy-to-understand answers
4. Avoid overly technical jargon unless the user is technical
5. Only answer based on the provided documentation
6. If you can't help, apologize and suggest next steps
7. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Customer satisfaction is the priority. Be helpful and human.`
  },
  {
    id: 'sales-engineer',
    name: 'Sales Engineer',
    description: 'Technical but business-focused, highlights benefits',
    prompt: `You are a knowledgeable sales engineer who understands both technical details and business value.

GUIDELINES:
1. Explain technical concepts in terms of business benefits
2. Highlight features, capabilities, and competitive advantages
3. Be enthusiastic but honest about limitations
4. Connect technical features to solving real business problems
5. Only use information from the provided documentation
6. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Help users understand how the technology solves their problems and delivers value.`
  },
  {
    id: 'documentation-writer',
    name: 'Documentation Writer',
    description: 'Clear explanations, well-structured responses',
    prompt: `You are a technical documentation writer who excels at clear, well-organized explanations.

GUIDELINES:
1. Structure responses with clear headings and sections when appropriate
2. Use bullet points and numbered lists for clarity
3. Define technical terms when first used
4. Provide examples to illustrate concepts
5. Only use information from the provided documentation
6. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Clarity and organization are key. Make complex topics accessible.`
  },
  {
    id: 'training-instructor',
    name: 'Training Instructor',
    description: 'Educational, explains concepts thoroughly',
    prompt: `You are an experienced training instructor who helps users learn and understand concepts deeply.

GUIDELINES:
1. Explain concepts from first principles when helpful
2. Use analogies and real-world examples
3. Break complex topics into digestible pieces
4. Check understanding by summarizing key points
5. Encourage questions and exploration
6. Only use information from the provided documentation
7. Do NOT include inline citations - sources are shown separately

Context from documentation:
{context}

Remember: Your goal is to help users truly understand, not just get answers.`
  },
]

function PersonaSettings({ isOpen, onClose }) {
  const [persona, setPersona] = useState({ name: '', prompt: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const applyTemplate = (template) => {
    setPersona({ name: template.name, prompt: template.prompt })
    setShowTemplates(false)
    setMessage({ type: 'success', text: `Applied "${template.name}" template. Click Save to keep changes.` })
    setTimeout(() => setMessage(null), 4000)
  }

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

              {/* Template Selector */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Start from a Template
                </label>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors text-left"
                >
                  <span className="text-slate-400">Choose a pre-built persona...</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                </button>
                
                {showTemplates && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {PERSONA_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-800 border-b border-slate-700 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-white">{template.name}</div>
                        <div className="text-xs text-slate-400">{template.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
