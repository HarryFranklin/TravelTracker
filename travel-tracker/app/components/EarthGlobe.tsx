"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { TravelLocation } from "../utils/types";

// Tuning limits for our central focal lens ring
const FOCAL_RING_LIMIT = 0.85;

interface CountryFeatureProperties {
  ADMIN: string;
  NAME: string;
  ISO_A3: string;
  BBOX: number[];
  LABEL_X: number;
  LABEL_Y: number;
}

interface CountryFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any[];
  };
  properties: CountryFeatureProperties;
  bbox?: number[];
}

interface EarthGlobeProps {
  locations: TravelLocation[];
  autoRotate: boolean;
  onGlobeClick: (coords: { lat: number; lng: number }, countryName?: string) => void;
  onMarkerClick: (location: TravelLocation) => void;
}

export default function EarthGlobe({ locations, autoRotate, onGlobeClick, onMarkerClick }: EarthGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); 
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isMounted, setIsMounted] = useState(false);
  
  const [countries, setCountries] = useState<{ features: CountryFeature[] }>({ features: [] });
  const [capitals, setCapitals] = useState<any[]>([]); 
  const [hoverD, setHoverD] = useState<CountryFeature | null>(null);
  
  const [camTarget, setCamTarget] = useState({ x: 0, y: 0, z: 1 });
  const [altitude, setAltitude] = useState(2.5);

  const oceanMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({ color: '#174a97', transparent: false });
  }, []);

  const sanitizeNameText = (str: string): string => {
    if (!str) return "";
    return str
      .normalize("NFD")                  
      .replace(/[\u0300-\u036f]/g, "")   
      .replace(/[^\x00-\x7F]/g, "")      
      .trim();
  };

  const isUnifiedRegion = (adminName: string): boolean => {
    return adminName === 'Israel' || adminName === 'West Bank' || adminName === 'Gaza' || adminName === 'Gaza Strip' || adminName === 'Palestine';
  };

  const getAdaptiveLabelMetrics = (fullName: string, bbox: number[], currentAltitude: number, dot: number): { text: string; size: number; opacity: number } => {
    let name = fullName.toUpperCase();
    
    if (dot < FOCAL_RING_LIMIT) return { text: "", size: 0, opacity: 0 };
    if (!bbox || bbox.length !== 4) return { text: name, size: 10, opacity: 0.6 };

    const lonWidth = Math.abs(bbox[2] - bbox[0]);
    const latHeight = Math.abs(bbox[3] - bbox[1]);
    
    const viewScale = 2.5 / currentAltitude;
    const availableSpace = Math.min(lonWidth, latHeight) * viewScale;

    if (availableSpace < 5.0) {
      if (name === "UNITED KINGDOM") name = "U.K.";
      else if (name === "UNITED STATES OF AMERICA" || name === "UNITED STATES") name = "U.S.A.";
      else if (name === "DEMOCRATIC REPUBLIC OF THE CONGO") name = "DR CONGO";
      else if (name === "CENTRAL AFRICAN REPUBLIC") name = "C.A.R.";
    }

    let dynamicSize = (availableSpace / name.length) * 4.8;
    dynamicSize = Math.max(8.5, Math.min(14, dynamicSize));

    if (availableSpace < 1.4 && name.length > 4) {
      return { text: "", size: 0, opacity: 0 };
    }

    const isCentral = dot > 0.94;
    
    let finalOpacity = isCentral ? 0.75 : 0.35;
    if (currentAltitude <= 1.3) {
      finalOpacity = isCentral ? 0.45 : 0.25;
    }

    return { text: name, size: dynamicSize, opacity: finalOpacity };
  };

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        const structuralRegionalRings: any[] = [];
        
        const standardFeatures = data.features.filter((f: any) => {
          const name = f.properties.ADMIN;
          if (isUnifiedRegion(name)) {
            if (f.geometry.type === 'Polygon') {
              structuralRegionalRings.push(f.geometry.coordinates);
            } else if (f.geometry.type === 'MultiPolygon') {
              f.geometry.coordinates.forEach((rings: any) => structuralRegionalRings.push(rings));
            }
            return false; 
          }
          return true;
        });

        if (structuralRegionalRings.length > 0) {
          standardFeatures.push({
            type: "Feature",
            geometry: {
              type: "MultiPolygon",
              coordinates: structuralRegionalRings
            },
            properties: {
              ADMIN: "Palestine",
              NAME: "Palestine",
              ISO_A3: "PSE",
              BBOX: [34.2, 31.2, 35.6, 33.3],
              LABEL_X: 35.15,
              LABEL_Y: 31.90
            }
          });
        }

        setCountries({ ...data, features: standardFeatures });
      });

    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson')
      .then(res => res.json())
      .then(data => {
        const parsedCapitals = data.features
          .filter((f: any) => {
            const coords = f.geometry?.coordinates;
            if (!coords || (coords[0] === 0 && coords[1] === 0)) return false;
            return f.properties.featurecla === 'Admin-0 capital' || f.properties.featurecla === 'Admin-0 capital alt';
          })
          .map((f: any) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            text: sanitizeNameText(f.properties.name),
            type: 'city'
          }));
        setCapitals(parsedCapitals);
      });
  }, []);

  const getVectorFromCoords = (lat: number, lng: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(Math.sin(phi) * Math.sin(theta)),
      Math.cos(phi),
      -(Math.sin(phi) * Math.cos(theta))
    ).normalize();
  };

  const labelDatabase = useMemo(() => {
    const results: any[] = [];
    const addedCountries = new Set<string>();

    countries.features.forEach((f) => {
      const props = f.properties;
      let lat = props.LABEL_Y;
      let lng = props.LABEL_X;
      const bbox = props.BBOX || f.bbox || [];

      if (lat === undefined || lng === undefined) {
        if (bbox.length === 4) {
          lng = (bbox[0] + bbox[2]) / 2; lat = (bbox[1] + bbox[3]) / 2;
        } else return;
      }

      const countryKey = sanitizeNameText(props.ADMIN);
      
      if (countryKey === "PALESTINE") {
        if (addedCountries.has("PALESTINE")) return;
        addedCountries.add("PALESTINE");
      }

      results.push({
        lat, lng,
        vec: getVectorFromCoords(lat, lng),
        name: countryKey,
        bbox,
        type: 'country'
      });
    });

    capitals.forEach(cap => {
      results.push({
        lat: cap.lat,
        lng: cap.lng,
        vec: getVectorFromCoords(cap.lat, cap.lng),
        name: cap.text,
        bbox: [],
        type: 'city'
      });
    });

    return results;
  }, [countries, capitals]);

  useEffect(() => {
    setIsMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);

    let animationId: number;

    const renderLoopTick = () => {
      if (globeRef.current && canvasRef.current && labelDatabase.length > 0) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const camera = globeRef.current.camera();
        
        if (ctx && camera) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const outwardLensVec = new THREE.Vector3(-dir.x, -dir.y, -dir.z).normalize();
          const pov = globeRef.current.pointOfView();

          const widthHalf = canvas.width / 2;
          const heightHalf = canvas.height / 2;
          const tempV = new THREE.Vector3();

          labelDatabase.forEach(d => {
            const dot = (d.vec.x * outwardLensVec.x) + (d.vec.y * outwardLensVec.y) + (d.vec.z * outwardLensVec.z);
            if (dot < FOCAL_RING_LIMIT) return;

            if (d.type === 'city' && (pov.altitude > 1.3 || dot < 0.94)) return;

            tempV.copy(d.vec).multiplyScalar(100);
            tempV.project(camera);

            const screenX = (tempV.x * widthHalf) + widthHalf;
            const screenY = -(tempV.y * heightHalf) + heightHalf;

            if (d.type === 'country') {
              const metrics = getAdaptiveLabelMetrics(d.name, d.bbox, pov.altitude, dot);
              if (metrics.size > 0 && metrics.text) {
                ctx.font = `900 ${metrics.size}px system-ui, -apple-system, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = `rgba(18, 32, 14, ${metrics.opacity})`;
                ctx.fillText(metrics.text, screenX, screenY);
              }
            } else {
              ctx.font = "800 10px system-ui, -apple-system, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              
              ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              ctx.fillText(`★ ${d.name.toUpperCase()}`, screenX + 1, screenY + 1);
              
              ctx.fillStyle = "#fcd34d";
              ctx.fillText(`★ ${d.name.toUpperCase()}`, screenX, screenY);
            }
          });
        }
      }

      animationId = requestAnimationFrame(renderLoopTick);
    };

    renderLoopTick();
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [labelDatabase]);

  useEffect(() => {
    if (isMounted && containerRef.current) {
      const parentNode = containerRef.current;
      parentNode.style.zIndex = "1";
      const innerOverlay = parentNode.querySelector(".scene-container") as HTMLElement;
      if (innerOverlay) {
        innerOverlay.style.zIndex = "1";
      }
    }
  }, [isMounted]);

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

  if (!isMounted) return <div style={{ width: '100vw', height: '100vh', backgroundColor: '#121214' }} />;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab', position: "relative", zIndex: 1 }}>
      
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 10, 
          pointerEvents: "none",
          overflow: "hidden"
        }}
      />

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

        // --- POLYGONS LAYER ---
        polygonsData={countries.features}
        polygonsTransitionDuration={0} 
        
        polygonAltitude={(f: any) => {
          const feature = f as CountryFeature;
          if (hoverD && (feature === hoverD || feature.properties.ADMIN === hoverD.properties.ADMIN)) {
            return 0.05;
          }
          return 0.02;
        }} 
        
        polygonCapColor={(f: any) => {
          const feature = f as CountryFeature;
          if (hoverD && (feature === hoverD || feature.properties.ADMIN === hoverD.properties.ADMIN)) {
            return '#6b8e5c';
          }
          return '#4f6d46';
        }}
        polygonSideColor={() => '#2d4026'} 
        
        // THE PERIMETER BORDER FIX: Strips out the internal dividing lines 
        // while cleanly maintaining the outer international boundary lines.
        polygonStrokeColor={(f: any) => {
          const feature = f as CountryFeature;
          const name = feature.properties.ADMIN;
          
          // If it matches our integrated block, draw the crisp standard boundary color
          if (name === "Palestine") {
            return '#174a97'; 
          }
          return '#174a97'; 
        }}
        onPolygonHover={(f: any) => setHoverD(f as CountryFeature | null)}

        onPolygonClick={(polygon: any, event, coords) => {
            const feature = polygon as CountryFeature;
            onGlobeClick({ lat: coords.lat, lng: coords.lng }, feature.properties.ADMIN);
        }}
        onGlobeClick={(clickObj) => {
            onGlobeClick({ lat: clickObj.lat, lng: clickObj.lng }, "Ocean / International Waters");
        }}

        // --- USER PIN LAYER ---
        labelsData={locations}
        labelLat={(d: any) => d.lat}
        labelLng={(d: any) => d.lng}
        labelText={(d: any) => d.name}
        labelSize={() => 1.6}
        labelDotRadius={() => 0.4}
        labelColor={(d: any) => d.status === 'visited' ? '#10b981' : '#f43f5e'}
        labelAltitude={() => 0.06}
        labelResolution={3}
        onLabelClick={(labelObj: any) => onMarkerClick(labelObj as TravelLocation)}
      />
    </div>
  );
}