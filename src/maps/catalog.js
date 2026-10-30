import * as Cesium from 'cesium';
export const MAP_STACKS = [
  {
    id: 'photoreal',
    label: 'Google 3D', // i18n-ignore: imagery product name
    shortLabel: '3D',
    kind: 'photoreal',
    requiresIon: false,
  },
  {
    id: 'bing-aerial',
    label: 'Bing Aerial', // i18n-ignore: imagery product name
    shortLabel: 'Aerial',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL,
    requiresIon: true,
  },
  {
    id: 'bing-labels',
    label: 'Bing Labels', // i18n-ignore: imagery product name
    shortLabel: 'Labels',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
    requiresIon: true,
  },
  {
    id: 'esri-imagery',
    label: 'Esri Satellite', // i18n-ignore: imagery product name
    shortLabel: 'SAT',
    kind: 'esri-imagery',
    requiresIon: false,
  },
  {
    id: 'osm',
    label: 'OSM', // i18n-ignore: imagery product name
    shortLabel: 'OSM',
    kind: 'osm',
    requiresIon: false,
  },
  // Regional, not global: the only stack here that covers one country. It stays
  // selectable worldwide rather than being hidden off its extent, because the
  // tray is a source list and a silently-missing chip reads as a bug.
  //
  // Off that extent the globe draws NO imagery for this stack, rather than
  // falling back: the provider's `rectangle` stops the request before it is
  // made, so there is no failure for `tileFailureFallback` to react to (that
  // fallback covers the service being down over Poland, which is a different
  // thing). Drawing a global basemap underneath would need the controller to
  // own a second imagery layer, which it deliberately does not.
  {
    id: 'gugik-orto',
    label: 'GUGiK Ortofotomapa', // i18n-ignore: imagery product name
    shortLabel: 'PL',
    kind: 'gugik-orto',
    requiresIon: false,
  },
];
