import * as Cesium from 'cesium';
import { gesutLayersParam } from './networks.js';
import { msg } from '../../i18n/marker.js';

/**
 * GESUT raster overlay: one WMS image layer draped on whatever surface the
 * shell is currently showing.
 *
 * The service is keyless and answers `Access-Control-Allow-Origin: *`, so tiles
 * load straight from the browser. Requests redirect from `integracja` to a
 * numbered node (`integracja01`, …) that carries the same CORS header; the
 * browser follows that itself.
 * @module layers/gesut/rendering
 */

export const GESUT_URL =
  'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu';

/** The service's own WGS84 bounding box, matching the orthophoto's extent. */
export const GESUT_RECTANGLE_DEGREES = Object.freeze({
  west: 13.8,
  south: 48.8,
  east: 24.4,
  north: 55.0,
});

/**
 * The service draws nothing above this zoom — measured, not guessed: the same
 * Gdynia tile comes back fully transparent at levels 14 and 15 and roughly a
 * third covered at 16 and 17. That is the scale window its capabilities
 * declare, and Cesium has no idea about it.
 *
 * It is NOT passed to the provider as `minimumLevel`. Doing that asks Cesium to
 * cover a coarse terrain tile with level-16 imagery, and across this rectangle
 * that is a tile explosion that hangs the page — the documented hazard of the
 * option. The layer gates on camera altitude instead, which costs nothing and
 * cannot stampede.
 */
export const GESUT_MIN_LEVEL = 16;

/**
 * Camera height below which the globe naturally asks for level-16 imagery, so
 * the overlay has something to show. Approximate by nature: it is a threshold
 * for attaching the layer, not a promise about any particular tile.
 */
export const GESUT_MAX_ALTITUDE_M = 6_000;

export const GESUT_MAX_LEVEL = 20;

/**
 * @param {Iterable<string>} networkIds - Selected network ids.
 * @param {object} [cesium] - Cesium namespace override, for tests.
 * @returns {object|null} A WMS imagery provider, or null when nothing is selected.
 */
export function createGesutProvider(networkIds, cesium = Cesium) {
  const layers = gesutLayersParam(networkIds);
  if (!layers) return null;
  const { west, south, east, north } = GESUT_RECTANGLE_DEGREES;
  return new cesium.WebMapServiceImageryProvider({
    url: GESUT_URL,
    layers,
    // 1.3.0 so the request carries CRS=EPSG:3857 to match the tiling scheme;
    // Cesium's default 1.1.1 would send the SRS form instead.
    parameters: {
      version: '1.3.0',
      transparent: true,
      format: 'image/png',
      styles: '',
    },
    tilingScheme: new cesium.WebMercatorTilingScheme(),
    rectangle: cesium.Rectangle.fromDegrees(west, south, east, north),
    maximumLevel: GESUT_MAX_LEVEL,
    enablePickFeatures: false,
    credit:
      '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GESUT © GUGiK</a>',
  });
}

/**
 * Owns the single imagery layer and re-attaches it when the shell's surface
 * changes (globe to 3D tileset and back), the way the weather overlay does.
 * @param {{getHost: Function, onChange?: Function, cesium?: object}} options - Rendering services.
 * @returns {{apply: Function, setAlpha: Function, detach: Function, destroy: Function, getDiagnostics: Function}} Controller.
 */
export function createGesutRendering({
  getHost,
  onChange = () => {},
  cesium = Cesium,
} = {}) {
  let layer = null;
  let collection = null;
  let alpha = 0.95;
  let signature = '';
  let error = null;

  const detach = () => {
    if (layer && collection && !collection.isDestroyed?.()) {
      collection.remove(layer, true);
    }
    layer = null;
    collection = null;
    signature = '';
  };

  return {
    /**
     * Draw the given networks, reusing the live layer when the selection and
     * surface are both unchanged — rebuilding it would drop loaded tiles and
     * flash the overlay off for every unrelated camera move.
     * @param {Iterable<string>} networkIds - Selected network ids.
     * @returns {void}
     */
    apply(networkIds) {
      const host = getHost?.();
      const nextCollection = host?.collection ?? null;
      const layersParam = gesutLayersParam(networkIds);
      const nextSignature = `${host?.kind ?? ''}|${layersParam}`;
      if (!nextCollection || !layersParam) {
        detach();
        return;
      }
      if (layer && collection === nextCollection && signature === nextSignature)
        return;
      detach();
      try {
        const provider = createGesutProvider(networkIds, cesium);
        layer = nextCollection.addImageryProvider(provider);
        layer.alpha = alpha;
        collection = nextCollection;
        signature = nextSignature;
        error = null;
      } catch (cause) {
        detach();
        error = cause?.message || msg('GESUT overlay failed');
      }
      onChange();
    },
    setAlpha(value) {
      alpha = Math.min(1, Math.max(0, Number(value) || 0));
      if (layer) layer.alpha = alpha;
    },
    detach,
    destroy() {
      detach();
    },
    getDiagnostics() {
      return { attached: Boolean(layer), alpha, error, signature };
    },
  };
}
