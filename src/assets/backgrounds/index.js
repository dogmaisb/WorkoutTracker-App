import muricaWeek     from './week/MURICA.png';
import muricaProgress from './progress/MURICA.png';
import muricaHistory  from './history/MURICA.png';
import muricaSettings from './settings/MURICA.png';
import muricaTimers   from './timers/MURICA.png';
import muricaDiet     from './diet/MURICA.png';

import hunterWeek     from './week/Grizzlyback.png';
import hunterProgress from './progress/Grizzlyback.png';
import hunterHistory  from './history/Grizzlyback.png';
import hunterSettings from './settings/Grizzlyback.png';
import hunterTimers   from './timers/Grizzlyback.png';
import hunterDiet     from './diet/Grizzlyback.png';

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
  HUNTER: {
    week:     hunterWeek,
    progress: hunterProgress,
    history:  hunterHistory,
    settings: hunterSettings,
    timers:   hunterTimers,
    diet:     hunterDiet,
  },
};

export default backgrounds;
