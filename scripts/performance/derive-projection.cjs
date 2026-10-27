/* Derive the exact Equal Earth fit from the authoritative unsimplified topology.
   The production map never needs to run this costly full-geometry fit. */
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const {geoEqualEarth,geoPath}=await import('d3');
 const {feature}=await import('topojson-client');
 const p=path.resolve(__dirname,'../../data/world-topology.js');
 const txt=fs.readFileSync(p,'utf8');
 const topology=JSON.parse(txt.slice(txt.indexOf('{'),txt.lastIndexOf('}')+1));
 const feats=feature(topology,topology.objects.countries).features;
 const projection=geoEqualEarth().fitExtent([[8,8],[992,512]],{type:'FeatureCollection',features:feats});
 const result={scale:projection.scale(),translate:projection.translate(),center:projection.center(),
   rotation:projection.rotate(),geometries:feats.length,studyCountries:195,
   arcs:topology.arcs.length,vertices:topology.arcs.reduce((a,b)=>a+b.length,0),
   bounds:geoPath(projection).bounds({type:'FeatureCollection',features:feats})};
 console.log('PR5_PROJECTION',JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});
