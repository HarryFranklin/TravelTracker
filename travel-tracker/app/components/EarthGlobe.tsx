"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { TravelLocation } from "../utils/types";

interface EarthGlobeProps {
  locations: TravelLocation[];
  autoRotate: boolean;
  onGlobeClick: (coords: { lat: number; lng: number }, countryName?: string) => void;
  onMarkerClick: (location: TravelLocation) => void;
}

export default function EarthGlobe({ locations, autoRotate, onGlobeClick, onMarkerClick }: EarthGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isMounted, setIsMounted] = useState(false);
  
  const [countries, setCountries] = useState({ features: [] });
  const [places, setPlaces] = useState({ features: [] });
  const [hoverD, setHoverD] = useState<any>(null);

  const [pov, setPov] = useState({ lat: 0, lng: 0, altitude: 2.5 });

  const oceanMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({ color: '#174a97', transparent: false });
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        const modifiedFeatures = data.features
          .filter((f: any) => f.properties.ADMIN !== 'West Bank' && f.properties.ADMIN !== 'Gaza')
          .map((f: any) => {
            if (f.properties.ADMIN === 'Israel') {
              return { ...f, properties: { ...f.properties, ADMIN: 'Palestine', NAME: 'Palestine' } };
            }
            return f;
          });
        setCountries({ ...data, features: modifiedFeatures });
      });

    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson')
      .then(res => res.json())
      .then(data => setPlaces(data));
  }, []);

  // --- CAMERA POLLING (ELIMINATES LAG) ---
  useEffect(() => {
    setIsMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);

    const interval = setInterval(() => {
      if (globeRef.current) {
        const currentPov = globeRef.current.pointOfView();
        setPov(prev => {
          const diffLat = Math.abs(prev.lat - currentPov.lat);
          const diffLng = Math.abs(prev.lng - currentPov.lng);
          // THE FIX: Use .altitude to perfectly match the library's TypeScript definitions
          const diffAlt = Math.abs(prev.altitude - currentPov.altitude);
          
          if (diffLat > 2 || diffLng > 2 || diffAlt > 0.1) {
            return { lat: currentPov.lat, lng: currentPov.lng, altitude: currentPov.altitude };
          }
          return prev;
        });
      }
    }, 200);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isMounted && globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.4;
        controls.minDistance = 120; 
        controls.maxDistance = 280; 
      }
    }
  }, [isMounted, autoRotate]);

  // --- FOVEATED RENDERING (Center-Focus Engine) ---
  const dynamicLabels = useMemo(() => {
    const userPins = locations.map(loc => ({ ...loc, isUserPin: true }));

    const processedAtlas: any[] = [];

    // 1. Process Countries (with bulletproof coordinate fallbacks)
    countries.features.forEach((f: any) => {
      let lat = f.properties.LABEL_Y;
      let lng = f.properties.LABEL_X;
      
      // If the dataset is missing a center point, extract the first physical coordinate so it never vanishes
      if (lat === undefined || lng === undefined) {
        try {
          const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0][0][0];
          lng = coords[0];
          lat = coords[1];
        } catch (e) { return; } // Skip if geography is corrupted
      }

      const adminName = f.properties.ADMIN === 'Israel' ? 'PALESTINE' : f.properties.ADMIN;
      
      // Calculate distance from the center of the user's screen
      const dist = Math.sqrt(Math.pow(lat - pov.lat, 2) + Math.pow(lng - pov.lng, 2));

      // Rule: Hide if it's over the horizon (> 70 degrees away)
      if (dist > 70) return;

      let isVisible = false;
      let opacity = 1;

      if (pov.altitude > 1.4) {
        isVisible = f.properties.POP_EST > 2000000;
        opacity = dist > 40 ? 0.3 : 0.6;
      } else if (pov.altitude > 0.8) {
        isVisible = dist > 25 && dist < 60;
        opacity = 0.5;
      } else {
        isVisible = dist > 35 && dist < 55;
        opacity = 0.3;
      }

      if (isVisible) {
        processedAtlas.push({
          lat, lng,
          text: adminName.toUpperCase(),
          size: 1.8,
          dotRadius: 0,
          alt: 0.035,
          color: `rgba(255, 255, 255, ${opacity})`,
          isUserPin: false
        });
      }
    });

    // 2. Process Cities
    places.features.forEach((f: any) => {
      const lat = f.geometry.coordinates[1];
      const lng = f.geometry.coordinates[0];
      const isCapital = f.properties.featurecla === 'Admin-0 capital' || f.properties.featurecla === 'Admin-0 capital alt';
      const pop = f.properties.pop_max || 0;
      
      const dist = Math.sqrt(Math.pow(lat - pov.lat, 2) + Math.pow(lng - pov.lng, 2));

      // Cull everything over the horizon or extreme edges
      if (dist > 60) return;

      let isVisible = false;

      if (pov.altitude > 1.4) {
        isVisible = false; 
      } else if (pov.altitude > 0.8) {
        isVisible = isCapital && dist < 25;
      } else {
        if (isCapital && dist < 35) isVisible = true;
        if (!isCapital && pop > 1000000 && dist < 15) isVisible = true;
      }

      if (isVisible) {
        processedAtlas.push({
          lat, lng,
          text: isCapital ? `• ${f.properties.name}` : `◦ ${f.properties.name}`,
          size: isCapital ? 1.0 : 0.8,
          dotRadius: isCapital ? 0.2 : 0.1,
          alt: 0.04,
          color: isCapital ? '#fcd34d' : '#cbd5e1',
          isUserPin: false
        });
      }
    });

    return [...userPins, ...processedAtlas];
  }, [locations, countries, places, pov]);

  if (!isMounted) return <div style={{ width: '100vw', height: '100vh', backgroundColor: '#121214' }} />;

  return (
    <div style={{ width: '100%', height: '100%', cursor: 'grab' }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#121214" 

        showAtmosphere={true} 
        atmosphereColor="#3a82f6"
        atmosphereAltitude={0.15}
        
        globeImageUrl={null}   
        globeMaterial={oceanMaterial}

        polygonsData={countries.features}
        polygonAltitude={d => d === hoverD ? 0.06 : 0.03} 
        polygonCapColor={d => d === hoverD ? '#6b8e5c' : '#4f6d46'}
        polygonSideColor={() => '#2d4026'} 
        polygonStrokeColor={() => '#174a97'} 
        onPolygonHover={setHoverD}

        onPolygonClick={(polygon: any, event, coords) => {
            onGlobeClick({ lat: coords.lat, lng: coords.lng }, polygon.properties.ADMIN);
        }}
        onGlobeClick={(clickObj) => {
            onGlobeClick({ lat: clickObj.lat, lng: clickObj.lng }, "Ocean / International Waters");
        }}

        // --- RENDER DYNAMIC LABELS ---
        labelsData={dynamicLabels}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.isUserPin ? d.name : d.text}
        labelSize={(d: any) => d.isUserPin ? 1.8 : d.size}
        labelDotRadius={(d: any) => d.isUserPin ? 0.5 : d.dotRadius}
        labelColor={(d: any) => d.isUserPin ? (d.status === 'visited' ? '#10b981' : '#f43f5e') : d.color}
        labelAltitude={(d: any) => d.isUserPin ? 0.07 : d.alt}
        labelResolution={3}
        onLabelClick={(labelObj: any) => {
          if (labelObj.isUserPin) onMarkerClick(labelObj as TravelLocation);
        }}
      />
    </div>
  );
}