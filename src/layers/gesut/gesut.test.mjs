import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GESUT_NETWORKS,
  GESUT_NETWORK_IDS,
  gesutLayersParam,
  gesutNetwork,
} from './networks.js';
import { GESUT_MAX_ALTITUDE_M } from './rendering.js';
import {
  createGesutLayers,
  createGesutNetworkLayer,
  GESUT_LAYER_IDS,
  gesutLayerId,
} from './index.js';

/** A viewer stub with the one imagery collection the layer may touch. */
function stubViewer(height = 900) {
  const added = [];
  return {
    added,
    camera: {
      positionCartographic: { height },
      moveEnd: { addEventListener: () => () => {} },
    },
    imageryLayers: {
      addImageryProvider(provider) {
        const layer = { provider, alpha: 1 };
        added.push(layer);
        return layer;
      },
      remove(layer) {
        const at = added.indexOf(layer);
        if (at >= 0) added.splice(at, 1);
      },
      isDestroyed: () => false,
    },
  };
}

/** Records what the provider was asked for without touching Cesium. */
function stubCesium() {
  const built = [];
  return {
    built,
    cesium: {
      WebMapServiceImageryProvider: class {
        constructor(options) {
          built.push(options);
          Object.assign(this, options);
        }
      },
      WebMercatorTilingScheme: class {},
      Rectangle: { fromDegrees: (...args) => ({ degrees: args }) },
    },
  };
}

test('the WMS layer list is the catalog order, never the order ids were given', () => {
  const reversed = [...GESUT_NETWORK_IDS].reverse();
  assert.equal(
    gesutLayersParam(reversed),
    GESUT_NETWORKS.map(({ wms }) => wms).join(','),
  );
  // WMS draws the list back to front, so a caller's order must not restack it.
  assert.equal(
    gesutLayersParam(['gas', 'water']),
    gesutLayersParam(['water', 'gas']),
  );
});

test('unknown network ids are dropped rather than reaching the service', () => {
  assert.equal(gesutLayersParam(['water', 'nonsense']), 'przewod_wodociagowy');
  assert.equal(gesutLayersParam([]), '');
  assert.equal(gesutLayersParam(undefined), '');
  assert.equal(gesutNetwork('nonsense'), null);
  assert.throws(
    () => createGesutNetworkLayer({ network: 'nonsense' }),
    /Unknown GESUT network/,
  );
});

test('every network names a distinct GESUT layer and carries a legend colour', () => {
  const wms = GESUT_NETWORKS.map((network) => network.wms);
  assert.equal(new Set(wms).size, wms.length);
  assert.equal(new Set(GESUT_NETWORK_IDS).size, GESUT_NETWORKS.length);
  for (const network of GESUT_NETWORKS) {
    assert.match(network.wms, /^przewod_/);
    assert.match(network.color, /^#[0-9a-f]{6}$/i);
    assert.ok(network.label);
  }
});

test('the catalog gets one independently toggleable layer per network', () => {
  const { cesium } = stubCesium();
  const layers = createGesutLayers({ cesium });
  assert.equal(layers.length, GESUT_NETWORKS.length);
  assert.deepEqual(
    layers.map(({ id }) => id),
    GESUT_LAYER_IDS,
  );
  assert.deepEqual(
    GESUT_LAYER_IDS,
    GESUT_NETWORK_IDS.map((id) => gesutLayerId(id)),
  );
  assert.equal(new Set(layers.map(({ name }) => name)).size, layers.length);
});

test('a network layer requests only its own run and never sets minimumLevel', () => {
  const { built, cesium } = stubCesium();
  const layer = createGesutNetworkLayer({ network: 'gas', cesium });
  layer.init(stubViewer());
  layer.enable();
  assert.equal(built.length, 1);
  const [options] = built;
  assert.equal(options.layers, gesutNetwork('gas').wms);
  assert.equal(options.parameters.version, '1.3.0');
  assert.equal(options.parameters.transparent, true);
  // Passing minimumLevel here stampedes Cesium into covering coarse terrain
  // tiles with level-16 imagery, which hangs the page.
  assert.equal('minimumLevel' in options, false);
  assert.equal(options.maximumLevel, 20);
});

test('toggling one network leaves the others untouched', () => {
  const { cesium } = stubCesium();
  const viewer = stubViewer();
  const water = createGesutNetworkLayer({ network: 'water', cesium });
  const gas = createGesutNetworkLayer({ network: 'gas', cesium });
  for (const layer of [water, gas]) {
    layer.init(viewer);
    layer.enable();
  }
  assert.equal(viewer.added.length, 2);
  water.disable();
  assert.equal(viewer.added.length, 1);
  assert.equal(viewer.added[0].provider.layers, gesutNetwork('gas').wms);
  assert.equal(gas.getStats().count, 1);
  assert.equal(water.getStats().count, 0);
});

test('above the altitude gate the overlay detaches instead of compositing blanks', () => {
  const { cesium } = stubCesium();
  const viewer = stubViewer(GESUT_MAX_ALTITUDE_M + 1);
  const layer = createGesutNetworkLayer({ network: 'water', cesium });
  layer.init(viewer);
  layer.enable();
  assert.equal(viewer.added.length, 0);
  assert.match(layer.getPanel().detail.status, /Zoom in/);

  viewer.camera.positionCartographic.height = GESUT_MAX_ALTITUDE_M - 1;
  layer.update();
  assert.equal(viewer.added.length, 1);
  assert.equal(layer.getPanel().detail.status, null);
});

test('an unchanged selection reuses the live layer instead of reloading tiles', () => {
  const { built, cesium } = stubCesium();
  const viewer = stubViewer();
  const layer = createGesutNetworkLayer({ network: 'power', cesium });
  layer.init(viewer);
  layer.enable();
  const first = viewer.added[0];
  layer.update();
  layer.update();
  assert.equal(built.length, 1);
  assert.equal(viewer.added[0], first);
});

test('disable detaches the overlay and destroy is safe to call afterwards', () => {
  const { cesium } = stubCesium();
  const viewer = stubViewer();
  const layer = createGesutNetworkLayer({ network: 'sewage', cesium });
  layer.init(viewer);
  layer.enable();
  assert.equal(viewer.added.length, 1);
  layer.disable();
  assert.equal(viewer.added.length, 0);
  layer.destroy();
  layer.destroy();
});

test('the panel states coverage rather than inferring it from an empty tile', () => {
  const { cesium } = stubCesium();
  const layer = createGesutNetworkLayer({ network: 'telecom', cesium });
  layer.init(stubViewer());
  layer.enable();
  const { detail, chips } = layer.getPanel();
  // An empty tile and "no pipes here" are the same answer from this service.
  assert.match(detail.coverage, /county by county/);
  assert.deepEqual(chips, []);
  assert.equal(layer.getDiagnostics().wms, gesutNetwork('telecom').wms);
});
