import React from 'react';

type SseStatus = 'connecting' | 'connected' | 'offline';

interface SseStatusBadgeProps {
  status: SseStatus;
}

export default function SseStatusBadge({ status }: SseStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          className: 'bg-green-100 text-green-800',
          text: 'REALTIME'
        };
      case 'connecting':
        return {
          className: 'bg-yellow-100 text-yellow-800',
          text: 'Connecting...'
        };
      case 'offline':
        return {
          className: 'bg-red-100 text-red-800',
          text: 'Offline'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.text}
    </span>
  );
}
