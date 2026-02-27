/**
 * Tutorial - Neon-Biological Style
 * Step-by-step tutorial overlay with bioluminescent design
 * Living arena aesthetic with neon glow effects
 */

import { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'phosphor-react';
import './Tutorial.css';

export interface TutorialStep {
  title: string;
  content: string;
  image?: string;
  action?: string;
}

export interface TutorialProps {
  steps: TutorialStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  className?: string;
}

export function Tutorial({ steps, onComplete, onSkip, showSkip = true, className = '' }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete?.();
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const step = steps[currentStep];

  return (
    <div className={`tutorial-overlay ${className}`}>
      <div className="tutorial-card">
        {/* Header */}
        <div className="tutorial-header">
          <div className="tutorial-step-info">
            <span className="tutorial-step-text">
              Step {currentStep + 1} of {steps.length}
            </span>
            <div className="tutorial-dots">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`tutorial-dot ${i === currentStep ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
          {showSkip && !isLast && (
            <button onClick={onSkip} className="tutorial-skip-btn">
              Skip
            </button>
          )}
        </div>

        {/* Content */}
        <div className={`tutorial-content ${isAnimating ? 'animating' : ''}`}>
          {step.image && (
            <div className="tutorial-image-wrapper">
              <img src={step.image} alt={step.title} className="tutorial-image" />
            </div>
          )}
          <h3 className="tutorial-title">{step.title}</h3>
          <p className="tutorial-description">{step.content}</p>
          {step.action && (
            <div className="tutorial-action-box">
              <ArrowRight size={16} weight="bold" className="tutorial-action-icon" />
              {step.action}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tutorial-footer">
          <button
            onClick={handleBack}
            disabled={isFirst}
            className="tutorial-btn tutorial-btn-back"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="tutorial-btn tutorial-btn-next"
          >
            {isLast ? (
              <>
                <Check size={16} weight="bold" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ArrowRight size={16} weight="bold" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact tutorial tooltip variant
interface TutorialTooltipProps {
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  visible: boolean;
  onClose?: () => void;
  children: React.ReactElement;
}

export function TutorialTooltip({ title, description, position = 'top', visible, onClose, children }: TutorialTooltipProps) {
  const [localVisible, setLocalVisible] = useState(false);

  useEffect(() => {
    setLocalVisible(visible);
  }, [visible]);

  if (!localVisible) return children;

  return (
    <div className="tutorial-tooltip-wrapper">
      {children}
      <div className={`tutorial-tooltip tutorial-tooltip-${position}`}>
        <div className="tutorial-tooltip-content">
          <div className="tutorial-tooltip-header">
            <h4 className="tutorial-tooltip-title">{title}</h4>
            {onClose && (
              <button onClick={onClose} className="tutorial-tooltip-close">
                <X size={14} />
              </button>
            )}
          </div>
          <p className="tutorial-tooltip-desc">{description}</p>
        </div>
        <div className="tutorial-tooltip-arrow" />
      </div>
    </div>
  );
}

export default Tutorial;
