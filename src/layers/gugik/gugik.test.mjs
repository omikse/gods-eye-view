import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUGIK_SERVICES,
  GUGIK_LAYER_IDS,
  gugikEntry,
  gugikLayerId,
  gugikMaxAltitude,
  gugikServiceLayerIds,
} from './services.js';
import {
  createGugikLayer,
  createGugikLayers,
  GUGIK_PANEL_GROUPS,
} from './index.js';

/** A viewer stub with the one imagery collection a layer may touch. */
function stubViewer(height = 500) {
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

test('every service names distinct WMS layers and a distinct catalog id', () => {
  assert.equal(new Set(GUGIK_LAYER_IDS).size, GUGIK_LAYER_IDS.length);
  for (const service of GUGIK_SERVICES) {
    assert.match(service.url, /^https:\/\//);
    assert.ok(service.maxAltitudeM > 0);
    const wms = service.layers.map((layer) => layer.wms);
    assert.equal(new Set(wms).size, wms.length);
    for (const layer of service.layers) {
      assert.ok(layer.label);
      assert.match(layer.color, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('a layer may override its service window where it does not share it', () => {
  // The national outlines draw at any zoom, but the cadastral-unit layers in
  // the same service were measured blank at a 30 km span.
  const country = gugikEntry('prg-country');
  const units = gugikEntry('prg-cadastral-units');
  assert.equal(gugikMaxAltitude(country), country.service.maxAltitudeM);
  assert.equal(gugikMaxAltitude(units), 20_000);
  assert.ok(gugikMaxAltitude(units) < gugikMaxAltitude(country));
  // A layer without an override simply takes its service's value.
  const parcels = gugikEntry('egib-parcels');
  assert.equal(gugikMaxAltitude(parcels), parcels.service.maxAltitudeM);
});

test('the record services keep their own measured scale windows', () => {
  const byId = Object.fromEntries(
    GUGIK_SERVICES.map((service) => [service.id, service.maxAltitudeM]),
  );
  // EGiB goes blank far sooner than GESUT, so one shared threshold would
  // either hide GESUT early or ask EGiB for blanks.
  assert.ok(byId.egib < byId.mpzp);
  assert.ok(byId.mpzp < byId.gesut);
  // The boundary and name services are drawn to be read from orbit.
  assert.ok(byId.prg > byId.gesut);
  assert.ok(byId.prng > byId.gesut);
});

test('imagery is not served from here — these layers are record data', () => {
  for (const id of GUGIK_LAYER_IDS) {
    assert.doesNotMatch(gugikEntry(id).service.url, /ORTO|WMTS/i);
  }
});

test('unknown ids are rejected rather than silently building a layer', () => {
  assert.equal(gugikEntry('nonsense'), null);
  assert.throws(() => createGugikLayer({ id: 'nonsense' }), /Unknown GUGiK/);
  assert.deepEqual(gugikServiceLayerIds('nonsense'), []);
});

test('the catalog gets one independently toggleable layer per record set', () => {
  const { cesium } = stubCesium();
  const layers = createGugikLayers({ cesium });
  assert.deepEqual(
    layers.map(({ id }) => id),
    GUGIK_LAYER_IDS,
  );
  assert.equal(new Set(layers.map(({ id }) => id)).size, layers.length);
});

test('panel groups cover every layer exactly once, in service order', () => {
  assert.deepEqual(
    GUGIK_PANEL_GROUPS.flatMap(({ ids }) => [...ids]),
    GUGIK_LAYER_IDS,
  );
  assert.deepEqual(
    GUGIK_PANEL_GROUPS.map(({ label }) => label),
    GUGIK_SERVICES.map(({ group }) => group),
  );
});

test('a layer requests only its own WMS layer and never sets minimumLevel', () => {
  const { built, cesium } = stubCesium();
  const layer = createGugikLayer({ id: 'egib-parcels', cesium });
  layer.init(stubViewer());
  layer.enable();
  assert.equal(built.length, 1);
  const [options] = built;
  assert.equal(options.layers, 'dzialki');
  assert.equal(options.parameters.version, '1.3.0');
  assert.equal(options.parameters.transparent, true);
  // Passing minimumLevel here stampedes Cesium into covering coarse terrain
  // tiles with deep imagery, which hangs the page.
  assert.equal('minimumLevel' in options, false);
  assert.equal(options.maximumLevel, 20);
});

test('each layer gates on its own service altitude, not a shared one', () => {
  const { cesium } = stubCesium();
  const parcels = createGugikLayer({ id: 'egib-parcels', cesium });
  const water = createGugikLayer({ id: 'gesut-water', cesium });
  // Between the two thresholds: GESUT still has something to draw, EGiB does
  // not, and a single global gate could not express that.
  const viewer = stubViewer(3_000);
  for (const layer of [parcels, water]) {
    layer.init(viewer);
    layer.enable();
  }
  assert.equal(viewer.added.length, 1);
  assert.equal(viewer.added[0].provider.layers, 'przewod_wodociagowy');
  assert.match(parcels.getPanel().detail.status, /Zoom in/);
  assert.equal(water.getPanel().detail.status, null);
});

test('dropping below the gate attaches, and rising above it detaches again', () => {
  const { cesium } = stubCesium();
  const viewer = stubViewer(50_000);
  const layer = createGugikLayer({ id: 'mpzp-raster', cesium });
  layer.init(viewer);
  layer.enable();
  assert.equal(viewer.added.length, 0);

  viewer.camera.positionCartographic.height = 100;
  layer.update();
  assert.equal(viewer.added.length, 1);

  viewer.camera.positionCartographic.height = 50_000;
  layer.update();
  assert.equal(viewer.added.length, 0);
});

test('toggling one record set leaves the others untouched', () => {
  const { cesium } = stubCesium();
  const viewer = stubViewer();
  const parcels = createGugikLayer({ id: 'egib-parcels', cesium });
  const buildings = createGugikLayer({ id: 'egib-buildings', cesium });
  for (const layer of [parcels, buildings]) {
    layer.init(viewer);
    layer.enable();
  }
  assert.equal(viewer.added.length, 2);
  parcels.disable();
  assert.equal(viewer.added.length, 1);
  assert.equal(viewer.added[0].provider.layers, 'budynki');
  assert.equal(buildings.getStats().count, 1);
  assert.equal(parcels.getStats().count, 0);
});

test('an unchanged surface reuses the live layer instead of reloading tiles', () => {
  const { built, cesium } = stubCesium();
  const viewer = stubViewer();
  const layer = createGugikLayer({ id: 'mpzp-zones', cesium });
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
  const layer = createGugikLayer({ id: 'gesut-sewage', cesium });
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
  const layer = createGugikLayer({ id: 'egib-land-use', cesium });
  layer.init(stubViewer());
  layer.enable();
  const { detail, chips } = layer.getPanel();
  // An empty tile and "no records here" are the same answer from these
  // services, so the panel states the rule instead of guessing.
  assert.match(detail.coverage, /county by county/);
  assert.deepEqual(chips, []);
  assert.equal(layer.getDiagnostics().wms, 'uzytki');
  assert.equal(layer.getDiagnostics().service, 'egib');
});

test('catalog ids are the service id joined to the layer id', () => {
  assert.equal(gugikLayerId('egib', 'parcels'), 'egib-parcels');
  assert.deepEqual(
    gugikServiceLayerIds('mpzp'),
    GUGIK_LAYER_IDS.filter((id) => id.startsWith('mpzp-')),
  );
});
