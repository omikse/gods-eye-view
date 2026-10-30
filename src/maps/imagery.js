import * as Cesium from 'cesium';

// Attribution and service rights are documented in DATA_SOURCES.md.
export const ESRI_ATTRIBUTION_HTML =
  '<a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a>';

export function createOsmImagery() {
  return new Cesium.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

export function createEsriImagery() {
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    {
      credit:
        'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      enablePickFeatures: false,
    },
  );
}

export function createIonImagery(style, accessToken) {
  accessToken = String(accessToken || '').trim();
  if (!accessToken) throw new Error('Ion imagery requires an explicit token');
  if (
    style === Cesium.IonWorldImageryStyle.AERIAL ||
    style === Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS
  ) {
    return createBingIonImagery(style, accessToken);
  }
  return Cesium.IonImageryProvider.fromAssetId(style, { accessToken });
}

async function createBingIonImagery(style, accessToken) {
  const endpoint = await new Cesium.Resource({
    url: `https://api.cesium.com/v1/assets/${style}/endpoint`,
    queryParameters: { access_token: accessToken },
  }).fetchJson();
  if (
    endpoint?.type !== 'IMAGERY' ||
    endpoint.externalType !== 'BING' ||
    typeof endpoint.options?.url !== 'string'
  ) {
    throw new Error('Ion world imagery did not return a Bing imagery endpoint');
  }
  // Bing otherwise follows the page's HTTP scheme on localhost. Resolve its
  // ion-issued credentials through public APIs so tiles use HTTPS without
  // weakening CSP, changing SDK defaults or touching provider internals.
  const { url, ...options } = endpoint.options;
  const provider = await Cesium.BingMapsImageryProvider.fromUrl(url, {
    ...options,
    tileProtocol: 'https',
  });
  const ionCredits = (endpoint.attributions ?? []).map(
    ({ html, collapsible }) => new Cesium.Credit(html, collapsible === false),
  );
  const getTileCredits = provider.getTileCredits.bind(provider);
  provider.getTileCredits = (x, y, level) => [
    ...ionCredits,
    ...(getTileCredits(x, y, level) ?? []),
  ];
  return provider;
}

// GUGiK publishes the national orthophoto as an open WMTS: no key, no account,
// and `Access-Control-Allow-Origin: *`, so tiles load straight from the browser
// with no proxy of ours in the path.
//
// The service advertises EPSG:2180, EPSG:3857 and EPSG:4326 matrix sets. We take
// EPSG:3857 because its scale denominators and top-left corner are the standard
// Web Mercator ladder that `WebMercatorTilingScheme` already indexes; only the
// MatrixWidth/MatrixHeight are clipped to the Polish extent, which costs us
// nothing because `rectangle` keeps Cesium from asking for tiles outside it.
//
// That rectangle is load-bearing, not an optimization. Outside the declared
// bounding box the service answers HTTP 200 with an XML exception instead of a
// tile, which would reach Cesium as an undecodable image and trip the tile
// failure path rather than reading as "no coverage here".
export const GUGIK_ORTO_RECTANGLE_DEGREES = Object.freeze({
  west: 13.8,
  south: 48.8,
  east: 24.4,
  north: 55.0,
});

export const GUGIK_ATTRIBUTION_HTML =
  '<a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">© GUGiK — Geoportal Krajowy</a>';

const GUGIK_ORTO_MAX_LEVEL = 19;

export function createGugikOrtoImagery() {
  const { west, south, east, north } = GUGIK_ORTO_RECTANGLE_DEGREES;
  return new Cesium.WebMapTileServiceImageryProvider({
    url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution',
    layer: 'ORTOFOTOMAPA',
    style: 'default',
    format: 'image/jpeg',
    tileMatrixSetID: 'EPSG:3857',
    // KVP mode: the matrix identifiers are prefixed, so the level number alone
    // is not what the service expects on the wire.
    tileMatrixLabels: Array.from(
      { length: GUGIK_ORTO_MAX_LEVEL + 1 },
      (_, level) => `EPSG:3857:${level}`,
    ),
    maximumLevel: GUGIK_ORTO_MAX_LEVEL,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    rectangle: Cesium.Rectangle.fromDegrees(west, south, east, north),
    credit: GUGIK_ATTRIBUTION_HTML,
    enablePickFeatures: false,
  });
}
