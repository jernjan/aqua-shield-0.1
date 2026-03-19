import React from 'react'
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface AlertProps {
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  onDismiss?: () => void
}

const severityConfig = {
  critical: {
    bg: 'bg-critical',
    text: 'text-white',
    icon: AlertTriangle,
    border: 'border-red-600',
  },
  high: {
    bg: 'bg-high',
    text: 'text-white',
    icon: AlertTriangle,
    border: 'border-orange-600',
  },
  medium: {
    bg: 'bg-medium',
    text: 'text-gray-800',
    icon: AlertCircle,
    border: 'border-yellow-600',
  },
  low: {
    bg: 'bg-low',
    text: 'text-gray-800',
    icon: CheckCircle,
    border: 'border-green-600',
  },
}

export const AlertBanner: React.FC<AlertProps> = ({
  severity,
  title,
  message,
  onDismiss,
}) => {
  const config = severityConfig[severity]
  const Icon = config.icon

  return (
    <div className={`${config.bg} ${config.text} p-4 rounded-lg border-l-4 ${config.border} flex items-start gap-3`}>
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-sm opacity-75 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  )
}
