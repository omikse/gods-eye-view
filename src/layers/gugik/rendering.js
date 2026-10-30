import * as Cesium from 'cesium';
import { GUGIK_RECTANGLE_DEGREES } from './services.js';
import { msg } from '../../i18n/marker.js';

/**
 * One WMS image layer per GUGiK data layer, draped on whatever surface the
 * shell is currently showing.
 *
 * The services are keyless and answer `Access-Control-Allow-Origin: *`, so
 * tiles load straight from the browser. The `integracja` host redirects to a
 * numbered node (`integracja01`, …) that carries the same header; the browser
 * follows that itself.
 * @module layers/gugik/rendering
 */

/**
 * Deepest level any of these services is worth asking for.
 *
 * There is deliberately no `minimumLevel` counterpart. Asking Cesium to cover
 * a coarse terrain tile with deep imagery across the Polish rectangle is a
 * tile explosion that hangs the page — the documented hazard of that option.
 * The scale window is enforced by the camera-altitude gate in `index.js`,
 * which costs nothing and cannot stampede.
 */
export const GUGIK_MAX_LEVEL = 20;

export const GUGIK_OVERLAY_FAILED = msg('GUGiK overlay failed');

/**
 * @param {{url: string, wms: string, credit: string}} target - Service URL, WMS layer name and credit.
 * @param {object} [cesium] - Cesium namespace override, for tests.
 * @returns {object} A WMS imagery provider.
 */
export function createGugikProvider({ url, wms, credit }, cesium = Cesium) {
  const { west, south, east, north } = GUGIK_RECTANGLE_DEGREES;
  return new cesium.WebMapServiceImageryProvider({
    url,
    layers: wms,
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
    maximumLevel: GUGIK_MAX_LEVEL,
    enablePickFeatures: false,
    credit,
  });
}

/**
 * Owns the single imagery layer and re-attaches it when the shell's surface
 * changes (globe to 3D tileset and back), the way the weather overlay does.
 * @param {{getHost: Function, target: object, onChange?: Function, cesium?: object}} options - Rendering services.
 * @returns {{apply: Function, setAlpha: Function, detach: Function, destroy: Function, getDiagnostics: Function}} Controller.
 */
export function createGugikRendering({
  getHost,
  target,
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
     * Draw the layer, reusing the live one while the surface is unchanged —
     * rebuilding it would drop loaded tiles and flash the overlay off for
     * every unrelated camera move.
     * @returns {void}
     */
    apply() {
      const host = getHost?.();
      const nextCollection = host?.collection ?? null;
      const nextSignature = `${host?.kind ?? ''}|${target.wms}`;
      if (!nextCollection) {
        detach();
        return;
      }
      if (layer && collection === nextCollection && signature === nextSignature)
        return;
      detach();
      try {
        layer = nextCollection.addImageryProvider(
          createGugikProvider(target, cesium),
        );
        layer.alpha = alpha;
        collection = nextCollection;
        signature = nextSignature;
        error = null;
      } catch (cause) {
        detach();
        error = cause?.message || GUGIK_OVERLAY_FAILED;
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
