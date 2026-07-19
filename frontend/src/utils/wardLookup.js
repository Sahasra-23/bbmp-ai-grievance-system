import * as turf from '@turf/turf';

let geojsonData = null;

export async function loadWardData() {
  if (geojsonData) return geojsonData;
  try {
    const response = await fetch('/data/BBMP.geojson');
    if (!response.ok) throw new Error("Failed to load BBMP.geojson");
    geojsonData = await response.json();
    return geojsonData;
  } catch (error) {
    console.error("Error loading ward data:", error);
    return null;
  }
}

export async function getWardFromCoordinates(lat, lng) {
  const data = await loadWardData();
  if (!data) return null;

  const point = turf.point([lng, lat]);
  
  for (const feature of data.features) {
    try {
      if (turf.booleanPointInPolygon(point, feature)) {
        return {
          wardNumber: feature.properties.KGISWardNo || feature.properties.WARD_NO || "",
          wardName: feature.properties.KGISWardName || feature.properties.WARD_NAME || ""
        };
      }
    } catch (err) {
      continue;
    }
  }
  return null;
}
