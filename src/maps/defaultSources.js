import { MAP_STACKS } from './catalog.js';
import { photorealUnavailableReason } from './availability.js';
import { keySetupRequirementEnvVars } from '../keySetupCore.mjs';
import { t } from '../i18n/index.js';
import {
  createOsmImagery,
  createEsriImagery,
  createIonImagery,
  createGugikOrtoImagery,
  ESRI_ATTRIBUTION_HTML,
  GUGIK_ATTRIBUTION_HTML,
} from './imagery.js';
import { createWorldTerrain, createKeylessTerrain } from './terrain.js';

/** Select sources and setup guidance without putting provider branches in the controller. */
export function createDefaultMapSources({
  googleTileset = null,
  cesiumToken = '',
  googleApiKey = '',
} = {}) {
  const ionToken = String(cesiumToken || '').trim();
  const hasIon = Boolean(ionToken);
  const hasGoogle = Boolean(String(googleApiKey || '').trim());
  const terrain = {
    id: hasIon ? 'world' : 'keyless',
    create: hasIon
      ? (request) => createWorldTerrain(ionToken, request)
      : createKeylessTerrain,
  };
  return {
    defaultId: googleTileset ? 'photoreal' : 'esri-imagery',
    unknownId: 'photoreal',
    recoveryId: googleTileset ? 'photoreal' : null,
    state: { hasCesiumIonToken: hasIon },
    sources: MAP_STACKS.map((descriptor) => {
      const common = {
        descriptor,
        available: !descriptor.requiresIon || hasIon,
        unavailableReason: descriptor.requiresIon
          ? t('Needs {envVars} — add it in Provider Settings', {
              envVars: keySetupRequirementEnvVars('cesium-ion'),
            })
          : null,
      };
      if (descriptor.kind === 'photoreal')
        return {
          ...common,
          available: Boolean(googleTileset),
          unavailableReason: photorealUnavailableReason(hasIon || hasGoogle),
          tileset: googleTileset,
        };
      const imagery =
        descriptor.kind === 'ion'
          ? () => createIonImagery(descriptor.style, ionToken)
          : descriptor.id === 'osm'
            ? createOsmImagery
            : descriptor.id === 'gugik-orto'
              ? createGugikOrtoImagery
              : createEsriImagery;
      return {
        ...common,
        imagery,
        terrain,
        ...(descriptor.id === 'esri-imagery'
          ? {
              credit: ESRI_ATTRIBUTION_HTML,
              constructionFallback: {
                id: 'osm',
                message: 'Esri Satellite is unavailable; using OSM',
              },
              tileFailureFallback: {
                id: 'osm',
                threshold: 2,
                message: 'Esri Satellite tile requests failed; using OSM',
              },
            }
          : {}),
        // One national service with no second supplier behind it, so both
        // fallbacks land on the global satellite stack rather than on OSM:
        // someone who picked an orthophoto wants imagery, not a road map.
        ...(descriptor.id === 'gugik-orto'
          ? {
              credit: GUGIK_ATTRIBUTION_HTML,
              constructionFallback: {
                id: 'esri-imagery',
                message: 'GUGiK Ortofotomapa is unavailable; using Esri',
              },
              // This guards the service being DOWN over Poland, nothing else:
              // off the extent the provider's `rectangle` stops the request
              // before it is made, so a camera abroad produces no failures to
              // count (measured — it sits on a blank globe indefinitely rather
              // than demoting itself). The threshold is far above the global
              // stacks' 2 because the camera only has to graze the border for a
              // few edge tiles to fail, and two of those must never demote a
              // working Polish view.
              tileFailureFallback: {
                id: 'esri-imagery',
                threshold: 12,
                message: 'GUGiK Ortofotomapa tile requests failed; using Esri',
              },
            }
          : {}),
      };
    }),
  };
}
