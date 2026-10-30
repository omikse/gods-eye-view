import * as Cesium from 'cesium';
import { createGugikRendering } from './rendering.js';
import {
  GUGIK_SERVICES,
  GUGIK_LAYER_IDS,
  gugikEntry,
  gugikLayerId,
} from './services.js';
import { imageryHostStatus } from '../weather/imageryHost.js';
import { t } from '../../i18n/index.js';

/**
 * The GUGiK national record overlays — buried utilities (GESUT), the land and
 * building register (EGiB) and local zoning plans (MPZP).
 *
 * One catalog layer per published WMS layer, so every record set toggles on
 * its own row in the Data Layers panel under its service's heading. That costs
 * one request per visible layer rather than one composited request per
 * service, which is the right side to spend on when the panel is where people
 * reach for a single record set.
 *
 * `services.js` carries the measurements behind the per-service altitude gates
 * and the coverage caveat these layers report.
 * @module layers/gugik
 */

export { GUGIK_LAYER_IDS, gugikLayerId } from './services.js';

/**
 * @param {{id: string, cesium?: object}} options - A catalog id such as `egib-parcels`, and an optional Cesium override for tests.
 * @returns {object} A data layer for the application catalog.
 */
export function createGugikLayer({ id, cesium = Cesium } = {}) {
  const entry = gugikEntry(id);
  if (!entry) throw new TypeError(`Unknown GUGiK layer: ${id}`);
  const { service, layer: descriptor } = entry;
  let viewer = null;
  let rendering = null;
  let imageryHost = null;
  let enabled = false;
  let removeCamera = null;
  let notifyChange = () => {};

  const getHost = () => {
    if (typeof imageryHost === 'function') return imageryHost();
    return viewer?.imageryLayers
      ? { collection: viewer.imageryLayers, kind: 'globe' }
      : null;
  };

  const cameraAltitude = () =>
    Number(viewer?.camera?.positionCartographic?.height) || 0;

  const tooHigh = () => cameraAltitude() > service.maxAltitudeM;

  const refresh = () => {
    if (!enabled || !rendering) return;
    // Detaching above the threshold is the whole zoom policy: the service
    // returns transparent tiles up there, so staying attached would spend
    // requests to composite nothing.
    if (tooHigh()) rendering.detach();
    else rendering.apply();
  };

  return {
    id,
    name: t(descriptor.label),
    icon: service.icon,
    source: service.source,
    init(nextViewer) {
      viewer = nextViewer;
      rendering = createGugikRendering({
        getHost,
        cesium,
        target: {
          url: service.url,
          wms: descriptor.wms,
          credit: service.credit,
        },
        onChange: () => notifyChange(),
      });
    },
    attachShellServices(services) {
      imageryHost =
        typeof services?.imageryHost === 'function'
          ? services.imageryHost
          : null;
      if (typeof services?.onChange === 'function')
        notifyChange = services.onChange;
      refresh();
    },
    enable() {
      enabled = true;
      // The surface under the overlay changes with the camera (the globe gives
      // way to the 3D tileset), and so does whether we are close enough to get
      // anything back, so re-apply on move rather than only on toggle.
      if (!removeCamera) {
        removeCamera = viewer?.camera?.moveEnd?.addEventListener(() => {
          refresh();
          notifyChange();
        });
      }
      refresh();
    },
    disable() {
      enabled = false;
      removeCamera?.();
      removeCamera = null;
      rendering?.detach();
    },
    update() {
      refresh();
    },
    getPanel() {
      return {
        detail: {
          status: tooHigh() ? t('Zoom in to load this record set') : null,
          coverage: t('Published county by county; many areas have none'),
          host: imageryHostStatus(getHost() ?? { kind: 'none' }),
        },
        chips: [],
      };
    },
    getStats() {
      const diagnostics = rendering?.getDiagnostics();
      return {
        count: diagnostics?.attached ? 1 : 0,
        countLabel: t('record set'),
        lastUpdate: null,
        loading: false,
        // A stored marker or a raw provider message; `t()` passes the latter
        // through unchanged, as the other layers' error text does.
        error: diagnostics?.error ? t(diagnostics.error) : null,
        stale: false,
        source: service.source,
      };
    },
    getDiagnostics() {
      return {
        ...rendering?.getDiagnostics(),
        service: service.id,
        wms: descriptor.wms,
        maxAltitudeM: service.maxAltitudeM,
        cameraAltitudeM: Math.round(cameraAltitude()),
      };
    },
    destroy() {
      removeCamera?.();
      removeCamera = null;
      rendering?.destroy();
      rendering = null;
      viewer = null;
    },
  };
}

/**
 * Every GUGiK record layer, in service then layer order.
 * @param {{cesium?: object}} [options] - Optional Cesium override for tests.
 * @returns {object[]} One layer per published WMS layer.
 */
export function createGugikLayers(options = {}) {
  return GUGIK_LAYER_IDS.map((id) => createGugikLayer({ ...options, id }));
}

/** The panel groups these layers contribute, in service order. */
export const GUGIK_PANEL_GROUPS = Object.freeze(
  GUGIK_SERVICES.map((service) =>
    Object.freeze({
      label: service.group,
      ids: Object.freeze(
        service.layers.map(({ id }) => gugikLayerId(service.id, id)),
      ),
    }),
  ),
);
