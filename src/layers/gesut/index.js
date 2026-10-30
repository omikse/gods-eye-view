import * as Cesium from 'cesium';
import { createGesutRendering, GESUT_MAX_ALTITUDE_M } from './rendering.js';
import { GESUT_NETWORKS, gesutNetwork } from './networks.js';
import { imageryHostStatus } from '../weather/imageryHost.js';
import { t } from '../../i18n/index.js';

/**
 * GESUT — the Polish national utility-network overlay (Krajowa Integracja
 * Uzbrojenia Terenu).
 *
 * One catalog layer per network, so each run toggles on its own row in the
 * Data Layers panel under a shared heading. That costs one WMS request per
 * visible network instead of one composited request for all nine; the panel is
 * where people reach for a single utility, so requests are the right side to
 * spend on.
 *
 * Coverage is the thing to understand about this source, and it is why the
 * layer states it rather than leaving a blank overlay to be read as a bug.
 * GESUT is maintained county by county and only some counties publish into the
 * national service, so at one zoom level central Gdynia returns dense geometry
 * while the Kraków market square returns an empty image. Nothing is wrong in
 * either case, and an empty answer is indistinguishable from "no pipes here",
 * so the layer states the rule instead of guessing which case it is in.
 * @module layers/gesut
 */

/** `gesut-water`, … — the catalog id for a network. */
export function gesutLayerId(networkId) {
  return `gesut-${networkId}`;
}

export const GESUT_LAYER_IDS = Object.freeze(
  GESUT_NETWORKS.map(({ id }) => gesutLayerId(id)),
);

/**
 * @param {{network: string, cesium?: object}} options - Which network, and an optional Cesium override for tests.
 * @returns {object} A data layer for the application catalog.
 */
export function createGesutNetworkLayer({ network, cesium = Cesium } = {}) {
  const descriptor = gesutNetwork(network);
  if (!descriptor) throw new TypeError(`Unknown GESUT network: ${network}`);
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

  const tooHigh = () => cameraAltitude() > GESUT_MAX_ALTITUDE_M;

  const refresh = () => {
    if (!enabled || !rendering) return;
    // Detaching above the threshold is the whole zoom policy: the service
    // returns transparent tiles up there, so staying attached would spend
    // requests to composite nothing.
    if (tooHigh()) rendering.detach();
    else rendering.apply([descriptor.id]);
  };

  return {
    id: gesutLayerId(descriptor.id),
    name: t(descriptor.label),
    icon: '╬',
    source: 'GUGiK GESUT · PL',
    init(nextViewer) {
      viewer = nextViewer;
      rendering = createGesutRendering({
        getHost,
        cesium,
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
          status: tooHigh() ? t('Zoom in to load utility networks') : null,
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
        countLabel: t('network'),
        lastUpdate: null,
        loading: false,
        // A stored marker or a raw provider message; `t()` passes the latter
        // through unchanged, as the other layers' error text does.
        error: diagnostics?.error ? t(diagnostics.error) : null,
        stale: false,
        source: 'GUGiK GESUT',
      };
    },
    getDiagnostics() {
      return {
        ...rendering?.getDiagnostics(),
        network: descriptor.id,
        wms: descriptor.wms,
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
 * Every GESUT network layer, in catalog order.
 * @param {{cesium?: object}} [options] - Optional Cesium override for tests.
 * @returns {object[]} One layer per network.
 */
export function createGesutLayers(options = {}) {
  return GESUT_NETWORKS.map(({ id }) =>
    createGesutNetworkLayer({ ...options, network: id }),
  );
}
