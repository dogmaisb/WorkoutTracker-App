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

export function useBackground(page) {
  const { themeName } = useTheme();
  const themeimgs = themeBackgrounds[themeName] || {};
  const img = themeimgs[page] || backgrounds[page];
  if (!img) return {};
  const overlayMap = themeName === 'AMERICAN' ? AMERICAN_OVERLAYS
    : themeName === 'HUNTER' ? HUNTER_OVERLAYS
    : OVERLAYS;
  const overlay = overlayMap[page] || 'rgba(0,0,0,0.70)';
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${img})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'local',
  };
}
