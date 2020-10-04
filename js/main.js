import mapboxgl from 'mapbox-gl'
import PathFinder from 'geojson-path-finder'
import * as turf from '@turf/turf'
import * as dat from 'dat.gui'
import {throttle} from 'lodash'

import geoJsonRoutes from '../data/routes.json'

// DOM

const info = document.querySelector('.info')

// CONF

const configuration = {
  showTiles: false,
  pathType: 'curved',
  pathWidth: 8,
  pathColor: '#000000',
  pathSimplification: 0.00004,
  pathCurveSharpness: 0.4,
  routesWidth: 3,
  routesColor: '#98bafa',
}


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

  map.addSource('tiles', {
    type: 'raster',
    tiles: [
      process.env.CUSTOM_TILES_URL
    ],
    tileSize: 256,
  })

  map.addLayer({
    id: 'tiles',
    source: 'tiles',
    type: 'raster',
    layout: {
      visibility: configuration.showTiles ? 'visible' : 'none',
    },
    minzoom: 13,
    maxZoom: 20,
  })

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
      'line-color': configuration.routesColor,
      'line-width': configuration.routesWidth,
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
      'line-color': configuration.pathColor,
      'line-width': configuration.pathWidth
    }
  })

  // calculate path

  updatePath()
})

// MARKERS

// start markers

const markerStartOnLine = new mapboxgl.Marker({
  color: '#c5f1b5',
  scale: 0.8
})
  .setLngLat([0, 0])
  .addTo(map)

const markerStart = new mapboxgl.Marker({
  draggable: true,
  color: '#2cbe06',
  scale: 1
})
  .setLngLat([2.5731, 49.1360])
  .addTo(map)

// end markers

const markerEndOnLine = new mapboxgl.Marker({
  color: '#f1b5b5',
  scale: 0.8
})
  .setLngLat([0, 0])
  .addTo(map)

const markerEnd = new mapboxgl.Marker({
  draggable: true,
  color: '#be061b',
  scale: 1
})
  .setLngLat([2.5699, 49.1340])
  .addTo(map)


// PATH

const geoJsonRoutesChunked = turf.lineChunk(geoJsonRoutes, 0.00005, {units: 'kilometers'})

const pathFinder = new PathFinder(geoJsonRoutesChunked, {precision: 0.00001})

const routesMultiLineString = turf.multiLineString(geoJsonRoutes.features.map(feature => feature.geometry.coordinates))

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
  if (!path) {
    console.warn('path not found')
    return 
  }

  // tranform to LineString object

  const pathLineString = turf.lineString(path.path)

  // simplify & curve path

  const pathLineStringSimplified = turf.simplify(pathLineString, {tolerance: configuration.pathSimplification})
  const pathLineStringCurved = turf.bezierSpline(pathLineStringSimplified, {resolution: 30000, sharpness: configuration.pathCurveSharpness})

  // update path on map

  switch (configuration.pathType) {
    case 'raw':
      map.getSource('path').setData(pathLineString)
      break;
    case 'simplified':
      map.getSource('path').setData(pathLineStringSimplified)
      break;
    case 'curved':
      map.getSource('path').setData(pathLineStringCurved)
      break;
  }

  // update info

  const pathLength = turf.length(pathLineStringCurved, {units: 'kilometers'})
  info.style.display = 'block'
  info.innerHTML = `Distance : ${Math.round(pathLength * 1000)} mètres`

}

// EVENTS

markerStart.on('drag', throttle(updatePath, 100))
markerEnd.on('drag', throttle(updatePath, 100))


// DAT GUI

const gui = new dat.GUI()

gui.add(configuration, 'showTiles')
  .name('Show tiles')
  .onChange(value => {
    map.setLayoutProperty('tiles', 'visibility', value ? 'visible' : 'none')
  })

// path folder

const pathFolder = gui.addFolder('Path')
pathFolder.open()

pathFolder.add(configuration, 'pathType', ['raw', 'simplified', 'curved'])
  .name('Path type')
  .onChange(() => {
    updatePath()
  })

pathFolder.add(configuration, 'pathWidth', 0, 16, 1)
  .name('Path width')
  .onChange((value) => {
    map.setPaintProperty('path', 'line-width', value)
  })

pathFolder.addColor(configuration, 'pathColor')
  .name('Path color')
  .onChange((value) => {
    map.setPaintProperty('path', 'line-color', value)
  })

pathFolder.add(configuration, 'pathSimplification', 0, 0.00015, 0.000005)
  .name('Path simplify')
  .onChange(throttle(() => {
    updatePath()
  }, 100))

pathFolder.add(configuration, 'pathCurveSharpness', 0, 1, 0.05)
  .name('Path curve')
  .onChange(throttle(() => {
    updatePath()
  }, 100))

// routes folder

const routesFolder = gui.addFolder('Routes')
routesFolder.open()

routesFolder.add(configuration, 'routesWidth', 0, 10, 1)
  .name('Routes width')
  .onChange((value) => {
    map.setPaintProperty('routes', 'line-width', value)
  })

routesFolder.addColor(configuration, 'routesColor')
  .name('Routes color')
  .onChange((value) => {
    map.setPaintProperty('routes', 'line-color', value)
  })
