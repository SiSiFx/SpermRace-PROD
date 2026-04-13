'use client';

import { memo, useCallback, useEffect, type CSSProperties } from 'react';
import { ArrowRight } from 'phosphor-react';
import {
  SpermClassType,
  getAllClassTypes,
  getClassDisplayInfo,
} from '../../game/engine/components/SpermClass';
import './ClassSelection.css';

interface ClassSelectionProps {
  selectedClass: SpermClassType;
  onSelect: (classType: SpermClassType) => void;
  onConfirm: () => void;
  visible: boolean;
}

const CLASS_DESC: Record<SpermClassType, string> = {
  [SpermClassType.BALANCED]: 'Best starting class. Block a deadly trail once, then keep going.',
  [SpermClassType.SPRINTER]: 'Escape anything. Blink through walls before they trap you.',
  [SpermClassType.TANK]:     'Play offense. Fatten your trail into a wall nobody can dodge.',
};

const CLASS_PLAYSTYLE: Record<SpermClassType, string> = {
  [SpermClassType.BALANCED]: 'All-Round',
  [SpermClassType.SPRINTER]: 'Aggressive',
  [SpermClassType.TANK]:     'Control',
};

const CLASS_ABILITY: Record<SpermClassType, {
  name: string;
  effect: string;
  cooldown: string;
}> = {
  [SpermClassType.BALANCED]: {
    name: 'SHIELD',
    effect: 'Survive touching one trail',
    cooldown: '8s cooldown',
  },
  [SpermClassType.SPRINTER]: {
    name: 'DASH',
    effect: 'Blink past any obstacle',
    cooldown: '3s cooldown',
  },
  [SpermClassType.TANK]: {
    name: 'OVERDRIVE',
    effect: 'Triple trail width for 3s',
    cooldown: '10s cooldown',
  },
};

// ─── Card helpers ─────────────────────────────────────────────────────────────

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function rgbChannels(value: number): string {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `${r} ${g} ${b}`;
}

function getCardVars(classType: SpermClassType): CSSProperties {
  const info = getClassDisplayInfo(classType);
  return {
    ['--class-color' as any]: hexColor(info.color),
    ['--class-rgb' as any]: rgbChannels(info.color),
  };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const ClassCard = memo(function ClassCard({
  classType,
  isSelected,
  onSelect,
}: {
  classType: SpermClassType;
  isSelected: boolean;
  onSelect: (c: SpermClassType) => void;
}) {
  const info = getClassDisplayInfo(classType);
  const cardVars = getCardVars(classType);
  const ability = CLASS_ABILITY[classType];

  return (
    <button
      type="button"
      className={`cs-card${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(classType)}
      aria-pressed={isSelected}
      style={cardVars}
    >
      {/* Header: icon + name + beginner badge */}
      <div className="cs-card-header">
        <span className="cs-card-icon" aria-hidden="true">{info.icon}</span>
        <div className="cs-card-name-wrap">
          <div className="cs-card-title-row">
            <span className="cs-card-name">{info.name}</span>
            {classType === SpermClassType.BALANCED && (
              <span className="cs-beginner-tag">Beginner</span>
            )}
          </div>
          <span className="cs-card-playstyle">{CLASS_PLAYSTYLE[classType]}</span>
        </div>
      </div>

      {/* Ability showcase */}
      <div className="cs-ability-visual">
        <div className="cs-ability-info">
          <span className="cs-ability-name">{ability.name}</span>
          <span className="cs-ability-effect">{ability.effect}</span>
        </div>
        <span className="cs-ability-cooldown">{ability.cooldown}</span>
      </div>

      {/* Plain-English description */}
      <p className="cs-card-desc">{CLASS_DESC[classType]}</p>
    </button>
  );
});

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ClassSelection({ selectedClass, onSelect, onConfirm, visible }: ClassSelectionProps) {
  const allClasses = getAllClassTypes();

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') onSelect(SpermClassType.BALANCED);
      else if (e.key === '2') onSelect(SpermClassType.SPRINTER);
      else if (e.key === '3') onSelect(SpermClassType.TANK);
      else if (e.key === 'Enter' || e.key === ' ') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onConfirm, onSelect]);

  const handleSelect = useCallback((c: SpermClassType) => onSelect(c), [onSelect]);

  if (!visible) return null;

  const selectedInfo = getClassDisplayInfo(selectedClass);
  const selectedVars = getCardVars(selectedClass);

  return (
    <div className="cs-root">
      <div className="cs-shell">
        <div className="cs-header">
          <h1 className="cs-title">Choose your class</h1>
          <p className="cs-subtitle">Pick how you want to play</p>
        </div>

        <div className="cs-cards">
          {allClasses.map((classType) => (
            <ClassCard
              key={classType}
              classType={classType}
              isSelected={selectedClass === classType}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <div className="cs-confirm-row">
          <button
            type="button"
            className="cs-confirm"
            onClick={onConfirm}
            style={selectedVars}
          >
            Play as {selectedInfo.name}
            <ArrowRight size={20} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClassSelection;
