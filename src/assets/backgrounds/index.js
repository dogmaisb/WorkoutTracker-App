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

import carbonWeek     from './week/Carbon.png';
import carbonProgress from './progress/Carbon.png';
import carbonHistory  from './history/Carbon.png';
import carbonSettings from './settings/Carbon.png';
import carbonTimers   from './timers/Carbon.png';
import carbonDiet     from './diet/Carbon.png';

import xmasWeek     from './week/XmasClaus.png';
import xmasProgress from './progress/XmasClaus.png';
import xmasHistory  from './history/XmasClaus.png';
import xmasSettings from './settings/XmasClaus.png';
import xmasTimers   from './timers/XmasClaus.png';
import xmasDiet     from './diet/XmasClaus.png';

import halloweenWeek     from './week/Halloween.png';
import halloweenProgress from './progress/Halloween.png';
import halloweenHistory  from './history/Halloween.png';
import halloweenSettings from './settings/Halloween.png';
import halloweenTimers   from './timers/Halloween.png';
import halloweenDiet     from './diet/Halloween.png';

import egyptWeek     from './week/EgyptianAnubis.png';
import egyptProgress from './progress/EgyptianAnubis.png';
import egyptHistory  from './history/EgyptianAnubis.png';
import egyptSettings from './settings/EgyptianAnubis.png';
import egyptTimers   from './timers/EgyptianAnubis.png';
import egyptDiet     from './diet/EgyptianAnubis.png';

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
  CARBON: {
    week:     carbonWeek,
    progress: carbonProgress,
    history:  carbonHistory,
    settings: carbonSettings,
    timers:   carbonTimers,
    diet:     carbonDiet,
  },
  CHRISTMAS: {
    week:     xmasWeek,
    progress: xmasProgress,
    history:  xmasHistory,
    settings: xmasSettings,
    timers:   xmasTimers,
    diet:     xmasDiet,
  },
  HALLOWEEN: {
    week:     halloweenWeek,
    progress: halloweenProgress,
    history:  halloweenHistory,
    settings: halloweenSettings,
    timers:   halloweenTimers,
    diet:     halloweenDiet,
  },
  EGYPTIAN: {
    week:     egyptWeek,
    progress: egyptProgress,
    history:  egyptHistory,
    settings: egyptSettings,
    timers:   egyptTimers,
    diet:     egyptDiet,
  },
};

export default backgrounds;
