import mapboxgl from 'mapbox-gl'
import PathFinder from 'geojson-path-finder'
import * as turf from '@turf/turf'
import { throttle } from 'lodash'

import geoJsonRoutes from '../data/routes.json'

const info = document.querySelector('.info')

// MAP

mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [2.5715, 49.1340],
  zoom: 15.5
})

map.on('load', () => {

  // tiles

  // TODO

  // routes

  map.addSource('routes', {
    type: 'geojson',
    data: geoJsonRoutes,
  })

  map.addLayer({
    id: 'routes',
    source: 'routes',
    type: 'line',
    layout: {
      'line-cap': 'round',
    },
    paint: {
      'line-color': '#98bafa',
      'line-opacity': 1,
      'line-width': 2
    }
  })

  // path

  map.addSource('path', {
    type: 'geojson',
    data: null,
  })

  map.addLayer({
    id: 'path',
    source: 'path',
    type: 'line',
    layout: {
      'line-cap': 'round',
    },
    paint: {
      'line-color': '#404040',
      'line-opacity': 1,
      'line-width': 5
    }
  })
})

// MARKERS

// start markers

const markerStartOnLine = new mapboxgl.Marker({
  color: "#c5f1b5"
})
  .setLngLat([0, 0])
  .addTo(map)

const markerStart = new mapboxgl.Marker({
  draggable: true,
  color: "#2cbe06"
})
  .setLngLat([2.5731, 49.1360])
  .addTo(map)

// end markers

const markerEndOnLine = new mapboxgl.Marker({
  color: "#f1b5b5"
})
  .setLngLat([0, 0])
  .addTo(map)

const markerEnd = new mapboxgl.Marker({
  draggable: true,
  color: "#be061b"
})
  .setLngLat([2.5699, 49.1340])
  .addTo(map)


// PATH

const geoJsonRoutesChunked = turf.lineChunk(geoJsonRoutes, 0.00005,{ units: 'kilometers'} )

const pathFinder = new PathFinder(geoJsonRoutesChunked, { precision: 0.00001 })

const routesMultiLineString = turf.multiLineString(geoJsonRoutes.features.map(feature => feature.geometry.coordinates));

const updatePath = () => {

  // get start and end with draggable markers

  const startPoint = turf.point([markerStart.getLngLat().lng, markerStart.getLngLat().lat])
  const endPoint = turf.point([markerEnd.getLngLat().lng, markerEnd.getLngLat().lat])

  // get nearest point on routes for start and end

  const nearestStartPointOnLine = turf.nearestPointOnLine(routesMultiLineString, startPoint)
  const nearestEndPointOnLine = turf.nearestPointOnLine(routesMultiLineString, endPoint)

  // set nearest markers coordinate

  markerStartOnLine.setLngLat(nearestStartPointOnLine.geometry.coordinates)
  markerEndOnLine.setLngLat(nearestEndPointOnLine.geometry.coordinates)

  // calculate path

  const path = pathFinder.findPath(nearestStartPointOnLine, nearestEndPointOnLine)
  if(!path) console.warn("path not found")

  // tranform to LineString object

  const pathLineString = turf.lineString(path.path)

  // simplify & curve path

  const pathLineStringSimplified = turf.simplify(pathLineString, {tolerance: 0.00003})
  const pathLineStringCurved = turf.bezierSpline(pathLineStringSimplified, {resolution: 30000, sharpness: 0.3})

  // update path on map

  map.getSource("path").setData(pathLineStringCurved);

  // update info

  const pathLength = turf.length(pathLineStringCurved, {units: "kilometers"})
  info.style.display = 'block'
  info.innerHTML = `Distance : ${Math.round(pathLength * 1000)} mètres`

}

// EVENTS

markerStart.on('drag', throttle(updatePath, 100))
markerEnd.on('drag', throttle(updatePath, 100))




