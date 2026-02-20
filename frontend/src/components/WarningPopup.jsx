import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function WarningPopup({ 
  show, 
  message, 
  violationCount, 
  maxViolations = 5, 
  onDismiss,
  autoDismissTime = 5000 
}) {
  const { isDark } = useTheme();
  const [progress, setProgress] = useState(100);
  
  const remainingViolations = maxViolations - violationCount;
  const isCritical = remainingViolations <= 1;
  
  useEffect(() => {
    if (!show) {
      setProgress(100);
      return;
    }
    
    // Progress bar animation
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (autoDismissTime / 100));
        return newProgress > 0 ? newProgress : 0;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [show, autoDismissTime]);
  
  if (!show) return null;
  
  const getSeverityColor = () => {
    if (isCritical) {
      return {
        bg: 'from-red-600 to-red-700',
        border: 'border-red-500',
        text: 'text-red-100',
        icon: 'text-red-200'
      };
    }
    return {
      bg: 'from-orange-500 to-orange-600',
      border: 'border-orange-400',
      text: 'text-orange-100',
      icon: 'text-orange-200'
    };
  };
  
  const colors = getSeverityColor();
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Popup */}
      <div className={`relative w-full max-w-lg mx-4 animate-bounce-in`}>
        <div className={`bg-gradient-to-r ${colors.bg} rounded-xl shadow-2xl border-2 ${colors.border} overflow-hidden`}>
          {/* Progress bar */}
          <div className="h-1 bg-white/20">
            <div 
              className="h-full bg-white/80 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 ${isCritical ? 'animate-pulse' : ''}`}>
                {isCritical ? (
                  <svg className="h-12 w-12 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-12 w-12 text-orange-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${colors.text} mb-1`}>
                  {isCritical ? '⚠️ FINAL WARNING!' : '⚠️ Violation Detected'}
                </h3>
                <p className={`${colors.text} text-sm mb-3`}>
                  {message}
                </p>
                
                {/* Violation Counter */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full bg-white/20 text-sm font-semibold ${colors.text}`}>
                    Violation #{violationCount}
                  </div>
                  <div className={`text-sm ${colors.text}`}>
                    {remainingViolations > 0 ? (
                      <span>{remainingViolations} more until auto-submit</span>
                    ) : (
                      <span className="font-bold">Auto-submit enabled!</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Close button */}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex-shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
