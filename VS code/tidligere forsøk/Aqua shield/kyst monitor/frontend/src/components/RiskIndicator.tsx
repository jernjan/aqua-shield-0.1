import React from 'react'

interface RiskLevelProps {
  level: string
  score?: number
  showLabel?: boolean
}

const getRiskColor = (level: string) => {
  const normalized = level.toUpperCase()
  switch (normalized) {
    case 'CRITICAL':
      return 'bg-critical text-white'
    case 'HIGH':
      return 'bg-high text-white'
    case 'MEDIUM':
      return 'bg-medium text-gray-800'
    case 'LOW':
      return 'bg-low text-white'
    default:
      return 'bg-gray-400 text-white'
  }
}

export const RiskLevel: React.FC<RiskLevelProps> = ({
  level,
  score,
  showLabel = true,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className={`px-3 py-1 rounded-full font-semibold text-sm ${getRiskColor(level)}`}>
        {showLabel ? level : null}
        {score !== undefined && ` (${(score * 100).toFixed(0)}%)`}
      </div>
    </div>
  )
}

interface RiskMeterProps {
  disease: number
  seaLice: number
  waterQuality: number
  escape: number
}

export const RiskMeter: React.FC<RiskMeterProps> = ({
  disease,
  seaLice,
  waterQuality,
  escape,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Disease Risk</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{(disease * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-red-500 h-2 rounded-full transition-all"
            style={{ width: `${disease * 100}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Sea Lice Risk</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{(seaLice * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${seaLice * 100}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Water Quality Risk</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{(waterQuality * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-yellow-500 h-2 rounded-full transition-all"
            style={{ width: `${waterQuality * 100}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Escape Risk</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{(escape * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${escape * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
