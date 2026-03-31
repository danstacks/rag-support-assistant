import { useState, useEffect, useCallback } from 'react'
import { 
  BarChart3, TrendingUp, Clock, MessageSquare, ThumbsUp, ThumbsDown,
  FileText, AlertTriangle, RefreshCw, X, Search, Eye
} from 'lucide-react'

const API_BASE = '/api'

export default function AnalyticsDashboard({ onClose }) {
  const [analytics, setAnalytics] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analyticsRes, queriesRes] = await Promise.all([
        fetch(`${API_BASE}/analytics`),
        fetch(`${API_BASE}/analytics/queries?limit=50`)
      ])
      
      const analyticsData = await analyticsRes.json()
      const queriesData = await queriesRes.json()
      
      setAnalytics(analyticsData)
      setQueryHistory(queriesData.queries || [])
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const formData = new FormData()
      formData.append('query', searchQuery)
      formData.append('k', '10')
      formData.append('use_hybrid', 'true')
      
      const response = await fetch(`${API_BASE}/search/semantic`, {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, subValue, color = 'indigo' }) => (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-900/50`}>
          <Icon className={`w-5 h-5 text-${color}-400`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
          {subValue && <p className="text-xs text-slate-500">{subValue}</p>}
        </div>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl p-8">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          <p className="mt-4 text-slate-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold">Analytics Dashboard</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalytics}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {['overview', 'queries', 'search'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && analytics && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={FileText}
                  label="Total Documents"
                  value={analytics.documents?.total_sources || 0}
                  subValue={`${analytics.documents?.total_chunks || 0} chunks`}
                  color="blue"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Total Queries"
                  value={analytics.queries?.total_queries || 0}
                  subValue={`${analytics.queries?.queries_last_24h || 0} in last 24h`}
                  color="purple"
                />
                <StatCard
                  icon={Clock}
                  label="Avg Response Time"
                  value={`${((analytics.queries?.avg_response_time_ms || 0) / 1000).toFixed(1)}s`}
                  color="green"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Confidence"
                  value={`${(analytics.queries?.avg_confidence || 0).toFixed(0)}%`}
                  color="amber"
                />
              </div>

              {/* Feedback Stats */}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" />
                  User Feedback
                </h3>
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-green-400" />
                    <span className="text-2xl font-bold text-green-400">
                      {analytics.feedback?.positive || 0}
                    </span>
                    <span className="text-slate-400">helpful</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5 text-red-400" />
                    <span className="text-2xl font-bold text-red-400">
                      {analytics.feedback?.negative || 0}
                    </span>
                    <span className="text-slate-400">not helpful</span>
                  </div>
                  {analytics.feedback?.total > 0 && (
                    <div className="ml-auto text-slate-400">
                      {((analytics.feedback.positive / analytics.feedback.total) * 100).toFixed(0)}% satisfaction rate
                    </div>
                  )}
                </div>
              </div>

              {/* Document Types */}
              {analytics.documents?.by_type && Object.keys(analytics.documents.by_type).length > 0 && (
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <h3 className="font-medium mb-4">Documents by Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analytics.documents.by_type).map(([type, count]) => (
                      <span
                        key={type}
                        className="px-3 py-1 bg-slate-700 rounded-full text-sm"
                      >
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Confidence Queries (Knowledge Gaps) */}
              {analytics.queries?.low_confidence_queries?.length > 0 && (
                <div className="bg-slate-800 rounded-xl p-4 border border-amber-700/50">
                  <h3 className="font-medium mb-4 flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    Potential Knowledge Gaps
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    These queries had low confidence scores - consider adding more documentation on these topics.
                  </p>
                  <div className="space-y-2">
                    {analytics.queries.low_confidence_queries.map((q, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg">
                        <span className="text-sm truncate flex-1">{q.query}</span>
                        <span className="text-xs text-amber-400 ml-2">
                          {q.confidence?.toFixed(0) || 0}% confidence
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'queries' && (
            <div className="space-y-4">
              <h3 className="font-medium">Recent Queries</h3>
              {queryHistory.length === 0 ? (
                <p className="text-slate-400 text-sm">No queries recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {queryHistory.slice().reverse().map((q, i) => (
                    <div key={i} className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm flex-1">{q.query}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full ${
                            (q.confidence || 0) >= 70 
                              ? 'bg-green-900/50 text-green-400' 
                              : (q.confidence || 0) >= 40 
                                ? 'bg-amber-900/50 text-amber-400'
                                : 'bg-red-900/50 text-red-400'
                          }`}>
                            {(q.confidence || 0).toFixed(0)}%
                          </span>
                          <span>{q.response_time_ms}ms</span>
                          <span>{q.docs_retrieved} docs</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(q.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search your knowledge base..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>

              {searchResults && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">
                    Found {searchResults.total} results using {searchResults.search_type} search
                  </p>
                  {searchResults.results.map((result, i) => (
                    <div key={i} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-indigo-400 truncate">
                          {result.title || result.source}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            result.relevance_score >= 70 
                              ? 'bg-green-900/50 text-green-400' 
                              : result.relevance_score >= 40 
                                ? 'bg-amber-900/50 text-amber-400'
                                : 'bg-red-900/50 text-red-400'
                          }`}>
                            {result.relevance_score?.toFixed(0)}% relevant
                          </span>
                          <span className="text-xs text-slate-500">{result.type}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-3">{result.content}</p>
                      <p className="text-xs text-slate-500 mt-2 truncate">{result.source}</p>
                    </div>
                  ))}
                </div>
              )}

              {!searchResults && (
                <div className="text-center py-12 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Search your knowledge base to preview documents</p>
                  <p className="text-sm mt-1">Uses hybrid search (semantic + keyword)</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
