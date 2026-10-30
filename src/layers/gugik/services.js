import { msg } from '../../i18n/marker.js';

/**
 * The GUGiK national WMS services this app draws as data overlays, and the
 * layers each one publishes.
 *
 * Imagery is deliberately not here: the orthophoto is a map stack
 * (`src/maps/imagery.js`), because a basemap and an overlay are different
 * things. Everything in this file is vector record data rendered to
 * transparent tiles — parcels, buildings, buried utilities, zoning.
 *
 * Two properties decide the shape of this table, and both were measured
 * against the live services rather than read off the capabilities:
 *
 * `maxAltitudeM` — each service stops drawing above its own scale window, and
 * the windows are nothing alike. GESUT still answers with a 6 km camera, while
 * EGiB parcels go blank somewhere under a 750 m span, so a single global
 * threshold would either spam one service with blank requests or hide the
 * other while it had plenty to say. A layer may override its service's value
 * where it does not share it: the national boundary layers draw at any zoom,
 * but the cadastral-unit ones inside the same service stop around 20 km.
 *
 * Coverage is maintained county by county and published unevenly, so an empty
 * tile is the ordinary answer rather than a fault — central Gdynia returns
 * dense land-use geometry where central Warsaw returns none, at the same zoom.
 * The layers state that rule in the panel instead of guessing which case they
 * are in.
 *
 * Pure data beyond the translation marker: `msg` only tags the labels so the
 * extractor finds them, and the UI translates them with `t()` where it draws
 * them. No Cesium, DOM or Node imports.
 * @module layers/gugik/services
 */

/** Shared by every service: the WGS84 box the data can possibly fall in. */
export const GUGIK_RECTANGLE_DEGREES = Object.freeze({
  west: 13.8,
  south: 48.8,
  east: 24.4,
  north: 55.0,
});

/** Above any camera height the globe allows, so the layer is never gated. */
export const UNRESTRICTED_ALTITUDE_M = Number.POSITIVE_INFINITY;

export const GUGIK_SERVICES = Object.freeze([
  Object.freeze({
    id: 'gesut',
    url: 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu',
    group: msg('Buried utilities (Poland)'),
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GESUT © GUGiK</a>',
    source: 'GUGiK GESUT · PL',
    icon: '╬',
    // Measured: the same Gdynia tile is fully transparent at zoom 14-15 and
    // about a third covered at 16-17.
    maxAltitudeM: 6_000,
    layers: Object.freeze([
      Object.freeze({
        id: 'water',
        wms: 'przewod_wodociagowy',
        label: msg('Water'),
        color: '#4aa3ff',
      }),
      Object.freeze({
        id: 'sewage',
        wms: 'przewod_kanalizacyjny',
        label: msg('Sewage'),
        color: '#8d6e4a',
      }),
      Object.freeze({
        id: 'gas',
        wms: 'przewod_gazowy',
        label: msg('Gas'),
        color: '#ffd24a',
      }),
      Object.freeze({
        id: 'power',
        wms: 'przewod_elektroenergetyczny',
        label: msg('Power'),
        color: '#ff5a5a',
      }),
      Object.freeze({
        id: 'telecom',
        wms: 'przewod_telekomunikacyjny',
        label: msg('Telecom'),
        color: '#4ad9c0',
      }),
      Object.freeze({
        id: 'heating',
        wms: 'przewod_cieplowniczy',
        label: msg('Heating'),
        color: '#ff9a3c',
      }),
      Object.freeze({
        id: 'special',
        wms: 'przewod_specjalny',
        label: msg('Special'),
        color: '#c08bff',
      }),
      Object.freeze({
        id: 'unidentified',
        wms: 'przewod_niezidentyfikowany',
        label: msg('Unidentified'),
        color: '#9aa4b2',
      }),
      Object.freeze({
        id: 'devices',
        wms: 'przewod_urzadzenia',
        label: msg('Devices'),
        color: '#e8edf2',
      }),
    ]),
  }),
  Object.freeze({
    id: 'egib',
    url: 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow',
    group: msg('Cadastre (Poland)'),
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">EGiB © GUGiK</a>',
    source: 'GUGiK EGiB · PL',
    icon: '▦',
    // Measured on Warsaw parcels: 39 kB of geometry across a 300 m span, a
    // near-empty image at 500 m and nothing at all from 750 m up. This is by
    // far the tightest window of the three.
    maxAltitudeM: 1_500,
    layers: Object.freeze([
      Object.freeze({
        id: 'parcels',
        wms: 'dzialki',
        label: msg('Parcels'),
        color: '#ff7a45',
      }),
      Object.freeze({
        id: 'parcel-numbers',
        wms: 'numery_dzialek',
        label: msg('Parcel numbers'),
        color: '#ffd24a',
      }),
      Object.freeze({
        id: 'buildings',
        wms: 'budynki',
        label: msg('Buildings'),
        color: '#ff5a5a',
      }),
      Object.freeze({
        id: 'land-use',
        wms: 'uzytki',
        label: msg('Land use'),
        color: '#6fd36f',
      }),
      Object.freeze({
        id: 'soil-classes',
        wms: 'kontury',
        label: msg('Soil classes'),
        color: '#c9a227',
      }),
      Object.freeze({
        id: 'districts',
        wms: 'obreby',
        label: msg('Cadastral districts'),
        color: '#4aa3ff',
      }),
    ]),
  }),
  Object.freeze({
    id: 'mpzp',
    url: 'https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego',
    group: msg('Zoning plans (Poland)'),
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">MPZP © GUGiK</a>',
    source: 'GUGiK MPZP · PL',
    icon: '▤',
    maxAltitudeM: 3_000,
    layers: Object.freeze([
      Object.freeze({
        id: 'boundaries',
        wms: 'granice',
        label: msg('Plan boundaries'),
        color: '#ff5a5a',
      }),
      Object.freeze({
        id: 'raster',
        wms: 'raster',
        label: msg('Raster plans'),
        color: '#d9d2c5',
      }),
      Object.freeze({
        id: 'areas',
        wms: 'wektor-pow',
        label: msg('Zoning areas'),
        color: '#c08bff',
      }),
      Object.freeze({
        id: 'lines',
        wms: 'wektor-lin',
        label: msg('Zoning lines'),
        color: '#4ad9c0',
      }),
      Object.freeze({
        id: 'points',
        wms: 'wektor-pkt',
        label: msg('Zoning points'),
        color: '#ffd24a',
      }),
      Object.freeze({
        id: 'zones',
        wms: 'wektor-str',
        label: msg('Zoning zones'),
        color: '#4aa3ff',
      }),
      Object.freeze({
        id: 'building-lines',
        wms: 'wektor-lzb',
        label: msg('Building lines'),
        color: '#ff9a3c',
      }),
    ]),
  }),
  Object.freeze({
    id: 'prg',
    url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WMS/AdministrativeBoundaries',
    group: msg('Administrative boundaries (Poland)'),
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">PRG © GUGiK</a>',
    source: 'GUGiK PRG · PL',
    icon: '⬡',
    // Unlike the record services, these are drawn to be read from orbit: the
    // state and voivodeship outlines return the same geometry at a 30 km span
    // as at 300 m, so the service itself is not gated.
    maxAltitudeM: UNRESTRICTED_ALTITUDE_M,
    layers: Object.freeze([
      Object.freeze({
        id: 'country',
        wms: 'A00_Granice_panstwa',
        label: msg('State border'),
        color: '#ff5a5a',
      }),
      Object.freeze({
        id: 'voivodeships',
        wms: 'A01_Granice_wojewodztw',
        label: msg('Voivodeships'),
        color: '#ff9a3c',
      }),
      Object.freeze({
        id: 'counties',
        wms: 'A02_Granice_powiatow',
        label: msg('Counties'),
        color: '#ffd24a',
      }),
      Object.freeze({
        id: 'communes',
        wms: 'A03_Granice_gmin',
        label: msg('Communes'),
        color: '#6fd36f',
      }),
      Object.freeze({
        id: 'cities',
        wms: 'A04_Granice_miast',
        label: msg('City limits'),
        color: '#4ad9c0',
      }),
      // Measured blank at a 30 km span where the layers above still draw.
      Object.freeze({
        id: 'cadastral-units',
        wms: 'A05_Granice_jednostek_ewidencyjnych',
        label: msg('Cadastral units'),
        color: '#4aa3ff',
        maxAltitudeM: 20_000,
      }),
      Object.freeze({
        id: 'cadastral-districts',
        wms: 'A06_Granice_obrebow_ewidencyjnych',
        label: msg('Cadastral district borders'),
        color: '#c08bff',
        maxAltitudeM: 20_000,
      }),
    ]),
  }),
  Object.freeze({
    id: 'prng',
    url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRNG/WMS/GeographicalNames',
    group: msg('Place names (Poland)'),
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">PRNG © GUGiK</a>',
    source: 'GUGiK PRNG · PL',
    icon: '⌖',
    maxAltitudeM: UNRESTRICTED_ALTITUDE_M,
    layers: Object.freeze([
      Object.freeze({
        id: 'settlements',
        wms: 'M1_UrzedoweNazwyMiejscowosci',
        label: msg('Official settlement names'),
        color: '#e8edf2',
      }),
      Object.freeze({
        id: 'settlements-other',
        wms: 'M2_PozostaleNazwyMiejscowosci',
        label: msg('Other settlement names'),
        color: '#9aa4b2',
      }),
      Object.freeze({
        id: 'features-official',
        wms: 'O1_UrzedoweNazwyObiektowFizjograficznych',
        label: msg('Official feature names'),
        color: '#4ad9c0',
        maxAltitudeM: 20_000,
      }),
      Object.freeze({
        id: 'features-standard',
        wms: 'O2_ZestandaryzowaneNazwyObiektowFizjograficznych',
        label: msg('Standardised feature names'),
        color: '#4aa3ff',
        maxAltitudeM: 20_000,
      }),
      Object.freeze({
        id: 'features-other',
        wms: 'O3_PozostaleNazwyObiektowFizjograficznych',
        label: msg('Other feature names'),
        color: '#c9a227',
        maxAltitudeM: 20_000,
      }),
    ]),
  }),
]);

/** `gesut-water`, `egib-parcels`, … — the catalog id for one service layer. */
export function gugikLayerId(serviceId, layerId) {
  return `${serviceId}-${layerId}`;
}

const ENTRIES = GUGIK_SERVICES.flatMap((service) =>
  service.layers.map((layer) => [
    gugikLayerId(service.id, layer.id),
    { service, layer },
  ]),
);

const BY_ID = new Map(ENTRIES);

/** Every catalog id this module contributes, in service then layer order. */
export const GUGIK_LAYER_IDS = Object.freeze(ENTRIES.map(([id]) => id));

/**
 * @param {string} id - A catalog id such as `egib-parcels`.
 * @returns {{service: object, layer: object}|null} Its service and layer, or null.
 */
export function gugikEntry(id) {
  return BY_ID.get(id) ?? null;
}

/**
 * The altitude gate that applies to a layer: its own, or its service's.
 * @param {{service: object, layer: object}} entry - A resolved entry.
 * @returns {number} Camera height in metres above which nothing is drawn.
 */
export function gugikMaxAltitude({ service, layer }) {
  return layer.maxAltitudeM ?? service.maxAltitudeM;
}

/** Catalog ids belonging to one service, in its own order. */
export function gugikServiceLayerIds(serviceId) {
  const service = GUGIK_SERVICES.find(({ id }) => id === serviceId);
  if (!service) return [];
  return service.layers.map(({ id }) => gugikLayerId(serviceId, id));
}
