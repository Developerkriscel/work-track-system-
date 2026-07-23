import { featureContracts } from './featureContracts';

function summarize(screen) {
  return {
    legacyScreen: screen.legacyScreen,
    views: screen.views.length,
    tabs: screen.tabs.length,
    filters: screen.filters.length,
    forms: screen.forms.length,
    templates: screen.templates.length,
    tables: screen.tables.length,
    charts: screen.charts.length,
    media: screen.media.length,
    modals: screen.modals.length,
    scripts: screen.scripts.length
  };
}

export const coverageMatrix = Object.entries(featureContracts).map(([feature, contract]) => ({
  feature,
  screenCount: contract.screens.length,
  screens: contract.screens.map(summarize)
}));

export function getCoverageForFeature(featureName) {
  return coverageMatrix.find((entry) => entry.feature === featureName) || null;
}
