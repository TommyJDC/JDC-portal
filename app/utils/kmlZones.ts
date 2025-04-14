// NOTE: This is a manual conversion of the provided secteurs.kml.
// A proper KML parsing library would be more robust but may not be
// available or easy to use in this environment.
// KML coordinates are lon,lat,alt. GeoJSON coordinates are lon,lat.

// Define the structure expected by the InteractiveMap component
interface KmlZoneFeature {
  type: "Feature";
  properties: {
    name: string;
    // Add other properties if needed from KML <Data> tags
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][]; // Array of LinearRings, first is outer, others are inner
  };
}

interface KmlZone {
  feature: KmlZoneFeature;
}

// Helper to convert KML coordinate string to GeoJSON number array format
const kmlCoordsToGeoJson = (kmlCoordString: string): number[][] => {
  return kmlCoordString
    .trim()
    .split(/\s+/) // Split by spaces
    .map(pair => {
      const coords = pair.split(','); // Split lon,lat,alt
      // Return only lon, lat as numbers
      return [parseFloat(coords[0]), parseFloat(coords[1])];
    })
    // Ensure the first and last points are the same for a valid LinearRing
    .filter(coords => !isNaN(coords[0]) && !isNaN(coords[1])); // Filter out potential NaN results
};

// Manually define the zones based on the KML structure
export const kmlZones: KmlZone[] = [
  {
    feature: {
      type: "Feature",
      properties: { name: "Baptiste" },
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            4.8836577,44.886044,0
            4.2842162,44.9924881,0
            3.8667357,44.7225929,0
            4.0644896,44.3231158,0
            4.646765,44.3034632,0
            5.4927123,44.1124911,0
            5.7151854,44.1834396,0
            5.4515135,44.405585,0
            5.836035,44.6894078,0
            5.4563201,44.7906117,0
            5.1425231,44.9652883,0
            5.0251067,44.94488,0
            4.8836577,44.886044,0
          `)
        ]
      }
    }
  },
  {
    feature: {
      type: "Feature",
      properties: { name: "julien Isère" }, // Note: KML name has space
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            5.4712372,45.0877866,0
            5.4087525,45.2146597,0
            5.3407746,45.3460764,0
            5.3579407,45.3923861,0
            5.154007,45.5084757,0
            5.1588727,45.6134865,0
            5.0592499,45.6488118,0
            4.8024445,45.5810905,0
            4.8628693,45.5253153,0
            4.7543793,45.4535917,0
            4.7548924,45.3637067,0
            4.8045044,45.3002118,0
            4.9947052,45.3475241,0
            5.1794129,45.2518931,0
            5.1505738,45.0800295,0
            5.3819733,45.0465649,0
            5.4712372,45.0877866,0
          `)
        ]
      }
    }
  },
  {
    feature: {
      type: "Feature",
      properties: { name: "Julien" },
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            5.4607639,44.7993594,0
            5.47999,45.0836844,0
            5.3804264,45.04343,0
            5.1462803,45.0788359,0
            5.1744328,45.2507031,0
            4.9952183,45.3444058,0
            4.8029575,45.2970908,0
            4.7548924,45.3637067,0
            4.5983372,45.2912944,0
            4.4905338,45.2303966,0
            4.2852268,44.9963497,0
            4.8812351,44.8894264,0
            5.0206242,44.946315,0
            5.1435337,44.968666,0
            5.4607639,44.7993594,0
          `)
        ]
      }
    }
  },
  {
    feature: {
      type: "Feature",
      properties: { name: "Florian" },
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            5.8179481,44.7013913,0
            6.1461645,44.8612524,0
            6.3569647,44.8558986,0
            6.3260653,45.0012533,0
            6.2072756,45.0187293,0
            6.2628937,45.1254119,0
            6.1619567,45.160767,0
            6.1303705,45.4370377,0
            5.9793082,45.5852412,0
            5.8893576,45.6020577,0
            5.6256856,45.6083024,0
            5.3626999,45.878565,0
            5.2226244,45.7661144,0
            5.0722489,45.7910165,0
            5.161513,45.6990145,0
            5.0592036,45.646717,0
            5.1615684,45.610667,0
            5.1546475,45.5049321,0
            5.3668206,45.3946213,0
            5.3482813,45.3459005,0
            5.4801178,45.0890645,0
            5.4718786,44.7959962,0
            5.8179481,44.7013913,0
          `)
        ]
      }
    }
  },
  {
    feature: {
      type: "Feature",
      properties: { name: "Matthieu" },
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            5.811555,46.0055516,0
            5.8369609,45.9325323,0
            5.8778364,45.8310799,0
            5.9590929,45.8132902,0
            5.9993579,45.7506936,0
            6.1535045,45.7550725,0
            6.18921,45.7004294,0
            6.3128062,45.6889188,0
            6.5181132,45.9038709,0
            6.7158671,45.7248816,0
            6.8023845,45.7718382,0
            7.0440837,45.9277564,0
            6.894395,46.118946,0
            6.8113109,46.1322712,0
            6.8628093,46.2829067,0
            6.7934581,46.3279694,0
            6.8161174,46.4269768,0
            6.5201732,46.458678,0
            6.2269755,46.3146916,0
            6.309373,46.2468299,0
            5.9578105,46.1346504,0
            5.8294078,46.1065697,0
            5.811555,46.0055516,0
          `)
        ]
      }
    }
  },
  {
    feature: {
      type: "Feature",
      properties: { name: "Guillem" },
      geometry: {
        type: "Polygon",
        coordinates: [
          kmlCoordsToGeoJson(`
            5.8274262,45.9345997,0
            5.7704346,45.7264774,0
            5.6413453,45.6194831,0
            5.889911,45.6108379,0
            5.984668,45.5940239,0
            6.1350434,45.4458434,0
            6.1789887,45.1744565,0
            6.2696259,45.1376567,0
            6.4591401,45.0523449,0
            6.6376679,45.1095567,0
            7.1526521,45.251852,0
            7.185611,45.4053629,0
            6.807956,45.7648112,0
            6.7118256,45.7188075,0
            6.5181916,45.8968606,0
            6.3190644,45.6823611,0
            6.1831086,45.693873,0
            6.147403,45.7456476,0
            5.9935944,45.7446893,0
            5.9496491,45.8069479,0
            5.8741181,45.8241765,0
            5.8274262,45.9345997,0
          `)
        ]
      }
    }
  }
];

// Ensure all polygons are closed (first and last point are identical)
kmlZones.forEach(zone => {
  zone.feature.geometry.coordinates.forEach(ring => {
    if (ring.length > 0) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        console.warn(`[kmlZones] Polygon ring for "${zone.feature.properties.name}" was not closed. Closing it.`);
        ring.push(first);
      }
    }
  });
});
