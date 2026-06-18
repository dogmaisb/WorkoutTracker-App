import muricaWeek     from './week/MURICA.png';
import muricaProgress from './progress/MURICA.png';
import muricaHistory  from './history/MURICA.png';
import muricaSettings from './settings/MURICA.png';
import muricaTimers   from './timers/MURICA.png';
import muricaDiet     from './diet/MURICA.png';

const backgrounds = {
  week:     null,
  progress: null,
  history:  null,
  diet:     null,
  timers:   null,
  settings: null,
};

export const themeBackgrounds = {
  AMERICAN: {
    week:     muricaWeek,
    progress: muricaProgress,
    history:  muricaHistory,
    settings: muricaSettings,
    timers:   muricaTimers,
    diet:     muricaDiet,
  },
};

export default backgrounds;
