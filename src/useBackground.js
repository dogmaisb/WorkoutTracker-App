import backgrounds, { themeBackgrounds } from './assets/backgrounds/index';
import { useTheme } from './ThemeContext';

const OVERLAYS = {
  week:     'rgba(4,12,24,0.72)',
  progress: 'rgba(10,6,2,0.70)',
  history:  'rgba(8,6,2,0.68)',
  diet:     'rgba(10,4,18,0.72)',
  timers:   'rgba(4,4,4,0.70)',
  settings: 'rgba(4,4,4,0.70)',
};

const AMERICAN_OVERLAYS = {
  week:     'rgba(10,18,40,0.60)',
  progress: 'rgba(10,18,40,0.60)',
  history:  'rgba(10,18,40,0.60)',
  settings: 'rgba(10,18,40,0.60)',
};

const HUNTER_OVERLAYS = {
  week:     'rgba(8,10,4,0.68)',
  progress: 'rgba(8,10,4,0.68)',
  history:  'rgba(8,10,4,0.66)',
  diet:     'rgba(8,10,4,0.68)',
  timers:   'rgba(6,8,2,0.70)',
  settings: 'rgba(6,8,2,0.70)',
};

const CHRISTMAS_OVERLAYS = {
  week:     'rgba(8,0,2,0.68)',
  progress: 'rgba(8,0,2,0.68)',
  history:  'rgba(8,0,2,0.66)',
  diet:     'rgba(8,0,2,0.68)',
  timers:   'rgba(8,0,2,0.70)',
  settings: 'rgba(8,0,2,0.70)',
};

const HALLOWEEN_OVERLAYS = {
  week:     'rgba(4,2,8,0.68)',
  progress: 'rgba(4,2,8,0.68)',
  history:  'rgba(4,2,8,0.66)',
  diet:     'rgba(4,2,8,0.68)',
  timers:   'rgba(4,2,8,0.70)',
  settings: 'rgba(4,2,8,0.70)',
};

const EGYPTIAN_OVERLAYS = {
  week:     'rgba(20,12,2,0.65)',
  progress: 'rgba(20,12,2,0.65)',
  history:  'rgba(20,12,2,0.63)',
  diet:     'rgba(20,12,2,0.65)',
  timers:   'rgba(16,10,2,0.68)',
  settings: 'rgba(16,10,2,0.68)',
};

export function useBackground(page) {
  const { themeName } = useTheme();
  const themeimgs = themeBackgrounds[themeName] || {};
  const img = themeimgs[page] || backgrounds[page];
  if (!img) return {};
  const overlayMap = themeName === 'AMERICAN' ? AMERICAN_OVERLAYS
    : themeName === 'HUNTER' ? HUNTER_OVERLAYS
    : themeName === 'HALLOWEEN' ? HALLOWEEN_OVERLAYS
    : themeName === 'CHRISTMAS' ? CHRISTMAS_OVERLAYS
    : themeName === 'EGYPTIAN' ? EGYPTIAN_OVERLAYS
    : OVERLAYS;
  const overlay = overlayMap[page] || 'rgba(0,0,0,0.70)';
  const bgSize = 'cover';
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${img})`,
    backgroundSize: bgSize,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'local',
  };
}
