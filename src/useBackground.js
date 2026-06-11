import backgrounds from './assets/backgrounds/index';

// Overlay opacity per page — darker = more readable text over busy photos
const OVERLAYS = {
  week:     'rgba(4,12,24,0.72)',
  progress: 'rgba(10,6,2,0.70)',
  history:  'rgba(8,6,2,0.68)',
  diet:     'rgba(10,4,18,0.72)',
  timers:   'rgba(4,4,4,0.70)',
  settings: 'rgba(4,4,4,0.70)',
};

export function useBackground(page) {
  const img = backgrounds[page];
  if (!img) return {};
  const overlay = OVERLAYS[page] || 'rgba(0,0,0,0.70)';
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${img})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'local',
  };
}
