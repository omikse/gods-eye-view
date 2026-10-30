/**
 * The GESUT utility networks GUGiK publishes nationally, in the order the
 * official viewers list them.
 *
 * `wms` names a layer of the Krajowa Integracja Uzbrojenia Terenu service.
 * They are requested together in one GetMap — WMS composites a comma-separated
 * `layers` list server-side, so nine visible networks still cost one image
 * rather than nine.
 *
 * `color` is for the legend only. The service renders its own cartography (the
 * conventional Polish surveying palette) and takes no style parameter, so these
 * values describe what the operator sees; they do not control it.
 *
 * Pure data beyond the translation marker: `msg` only tags the labels so the
 * extractor finds them, and the UI translates them with `t()` where it draws
 * them. No Cesium, DOM or Node imports.
 * @module layers/gesut/networks
 */

import { msg } from '../../i18n/marker.js';

export const GESUT_NETWORKS = Object.freeze([
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
]);

export const GESUT_NETWORK_IDS = Object.freeze(
  GESUT_NETWORKS.map(({ id }) => id),
);

const BY_ID = new Map(GESUT_NETWORKS.map((network) => [network.id, network]));

/**
 * The service's `layers` parameter for a selection, in catalog order.
 *
 * Order is fixed by `GESUT_NETWORKS` rather than by the order ids arrived in,
 * because WMS draws the list back to front: letting the caller's toggle order
 * through would silently restack the drawing as networks are switched on and
 * off, so the same ground would paint differently depending on click order.
 * @param {Iterable<string>} ids - Selected network ids; unknown ids are dropped.
 * @returns {string} Comma-separated WMS layer names, empty when nothing matches.
 */
export function gesutLayersParam(ids) {
  const wanted = new Set(ids ?? []);
  return GESUT_NETWORKS.filter(({ id }) => wanted.has(id))
    .map(({ wms }) => wms)
    .join(',');
}

/**
 * @param {string} id - Network id.
 * @returns {{id: string, wms: string, label: string, color: string}|null} The network, or null.
 */
export function gesutNetwork(id) {
  return BY_ID.get(id) ?? null;
}
