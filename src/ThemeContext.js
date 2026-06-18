import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes } from './themes';
import { loadSettings, saveSettings } from './storage';

const ThemeContext = createContext({ theme: themes.DEFAULT, themeName: 'DEFAULT', changeTheme: () => {} });

const CSS_VAR_MAP = {
  bgApp:'--bgApp', bgAppMobile:'--bgAppMobile', bgPhone:'--bgPhone',
  bgStatusBar:'--bgStatusBar', bgTopBar:'--bgTopBar', bgNav:'--bgNav',
  bgCard:'--bgCard', bgCardAlt:'--bgCardAlt', bgSurface:'--bgSurface',
  bgSurfaceRaised:'--bgSurfaceRaised', bgInput:'--inputBg', bgInputDark:'--bgCardAlt',
  borderDefault:'--borderDefault', borderActive:'--borderActive', borderMuted:'--borderMuted',
  borderRaised:'--borderRaised', borderTopBar:'--borderTopBar', borderPhone:'--borderPhone',
  textPrimary:'--textPrimary', textSecondary:'--textSecondary', textMuted:'--textMuted',
  textOnAccent:'--textOnAccent', textHeading:'--textHeading',
  accentGreen:'--accentGreen', accentGreenBright:'--accentGreenBright',
  accentGreenNeon:'--accentGreenNeon', accentGreenDark:'--accentGreenDark',
  accentGreenDeep:'--accentGreenDeep', accentBlue:'--accentBlue',
  accentBlueLight:'--accentBlueLight', accentBluePale:'--accentBluePale',
  accentBlueSky:'--accentBlueSky', accentBlueDeep:'--accentBlueDeep',
  accentOrange:'--accentOrange', accentOrangeDark:'--accentOrangeDark',
  accentOrangeGold:'--accentOrangeGold', accentRedSoft:'--accentRedSoft',
  accentGold:'--accentGold',
  navInactive:'--navInactive', navHover:'--navHover', navActive:'--navActive',
  inputBg:'--inputBg', inputBorder:'--inputBorder', inputText:'--inputText',
  inputBorderFocus:'--inputBorderFocus', inputPlaceholder:'--inputPlaceholder',
  chipBg:'--chipBg', chipBorder:'--chipBorder', chipText:'--chipText',
  chipBorderHover:'--chipBorderHover', chipTextHover:'--chipTextHover',
  chipActiveBg:'--chipActiveBg', chipActiveText:'--chipActiveText',
  mchipActiveBg:'--mchipActiveBg',
  statBoxBg:'--statBoxBg', statBoxVal:'--statBoxVal', statBoxLbl:'--statBoxLbl',
  badgeBg:'--badgeBg', badgeText:'--badgeText', badgeBorder:'--badgeBorder',
  prBadgeBg:'--prBadgeBg', prBadgeText:'--prBadgeText',
  flashText:'--flashText', emptyText:'--emptyText', dividerColor:'--dividerColor',
  backBtn:'--backBtn', sectionLabel:'--sectionLabel',
  buttonFdeBg:'--buttonFdeBg', buttonFdeBgHover:'--buttonFdeBgHover',
  buttonFdeText:'--buttonFdeText', buttonGreenBg:'--buttonGreenBg',
  buttonGreenText:'--buttonGreenText', buttonGreenBorder:'--buttonGreenBorder',
  weekBg:'--weekBg', weekCard:'--weekCard', dayPillBg:'--dayPillBg',
  dayPillTodayBg:'--dayPillTodayBg', dayPillTodayText:'--dayPillTodayText', dayLabel:'--dayLabel', dayNum:'--dayNum',
  dayDot:'--dayDot', exRowBorder:'--exRowBorder', exName:'--exName',
  circuitHeader:'--circuitHeader', circuitLine:'--circuitLine', logTitle:'--logTitle',
  bgTopBarWeek:'--bgTopBarWeek',
  chartCardBg:'--chartCardBg', chartCardBorder:'--chartCardBorder',
  chartTitle:'--chartTitle', sprintCardBg:'--sprintCardBg', sprintDist:'--sprintDist',
  sprintPr:'--sprintPr', sprintNone:'--sprintNone', sprintActiveBg:'--sprintActiveBg',
  chartCardBgAlt:'--chartCardBgAlt', chartCardBorderAlt:'--chartCardBorderAlt',
  chartCardGlow1:'--chartCardGlow1', chartCardGlow2:'--chartCardGlow2', chartCardGlow3:'--chartCardGlow3',
  chartTitleAlt:'--chartTitleAlt', progressBg:'--progressBg',
  progressStatusText:'--progressStatusText', progressTopH1:'--progressTopH1',
  historyBg:'--historyBg', historyStatusBg:'--historyStatusBg',
  historyCardBg:'--historyCardBg', historyBorder:'--historyBorder',
  historyText:'--historyText', historyTextMuted:'--historyTextMuted',
  historyGold:'--historyGold', historyGoldSoft:'--historyGoldSoft',
  historyRowBg:'--historyRowBg', historyRowHover:'--historyRowHover',
  historyAccent:'--historyAccent', prCardBg:'--prCardBg', prCardBorder:'--prCardBorder',
  prCardVal:'--prCardVal', prCardLbl:'--prCardLbl', eiRowBg:'--eiRowBg',
  eiVal:'--eiVal', drVal:'--drVal', drNote:'--drNote', isPrBg:'--isPrBg',
  timersBg:'--timersBg', timersStatusText:'--timersStatusText',
  timersTabBg:'--timersTabBg', timersTabBorder:'--timersTabBorder',
  timersTabText:'--timersTabText', timersTabHover:'--timersTabHover',
  timersTabActive:'--timersTabActive', timersChipBg:'--timersChipBg',
  timersChipBorder:'--timersChipBorder', timersChipText:'--timersChipText',
  timersGreen:'--timersGreen', timersGreenBg:'--timersGreenBg',
  timersGreenBorder:'--timersGreenBorder', timersDotDone:'--timersDotDone',
  timersText:'--timersText', timersTextMuted:'--timersTextMuted',
  timersTextDim:'--timersTextDim', timersSurface:'--timersSurface',
  timersSurfaceLight:'--timersSurfaceLight', timersSwDisplay:'--timersSwDisplay',
  dietBg:'--dietBg', dietStatusBg:'--dietStatusBg', dietStatusText:'--dietStatusText',
  dietBorder:'--dietBorder',
  tagBtnBg:'--tagBtnBg', tagBtnBorder:'--tagBtnBorder', tagBtnText:'--tagBtnText',
  tagBtnHoverBg:'--tagBtnHoverBg', notesText:'--notesText',
  settingsLabel:'--settingsLabel', settingsVal:'--settingsVal',
  comingItem:'--comingItem',
  navLabelColor:'--navLabelColor',
};

function applyThemeToCssVars(theme) {
  const root = document.documentElement;
  Object.entries(CSS_VAR_MAP).forEach(([token, cssVar]) => {
    if (theme[token] !== undefined) root.style.setProperty(cssVar, theme[token]);
  });
}

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => loadSettings().theme || 'DEFAULT');
  const theme = themes[themeName] || themes.DEFAULT;

  useEffect(() => {
    applyThemeToCssVars(theme);
    document.documentElement.setAttribute('data-theme', themeName);
  }, [theme, themeName]);

  function changeTheme(name) {
    setThemeName(name);
    saveSettings({ ...loadSettings(), theme: name });
  }

  return (
    <ThemeContext.Provider value={{ theme, themeName, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
