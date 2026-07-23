import { featureContracts } from './featureContracts';

function flattenSurfaceEntries(featureName, screens) {
  return screens.flatMap((screen) => {
    const entries = [];
    const addEntries = (type, values) => {
      (values || []).forEach((value) => {
        entries.push({
          feature: featureName,
          legacyScreen: screen.legacyScreen,
          surfaceType: type,
          legacyId: value
        });
      });
    };

    addEntries('view', screen.views);
    addEntries('tab', screen.tabs);
    addEntries('filter', screen.filters);
    addEntries('form', screen.forms);
    addEntries('template', screen.templates);
    addEntries('table', screen.tables);
    addEntries('chart', screen.charts);
    addEntries('media', screen.media);
    addEntries('modal', screen.modals);
    addEntries('script', screen.scripts);

    return entries;
  });
}

export const surfaceRegistry = Object.entries(featureContracts).flatMap(([featureName, contract]) =>
  flattenSurfaceEntries(featureName, contract.screens)
);

export function getFeatureSurfaces(featureName) {
  return surfaceRegistry.filter((entry) => entry.feature === featureName);
}
