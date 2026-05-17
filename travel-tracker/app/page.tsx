"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TravelLocation } from "./utils/types";

const EarthGlobe = dynamic(() => import("./components/EarthGlobe"), { 
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121214', color: '#a1a1aa', fontFamily: 'sans-serif', fontSize: '14px', fontWeight: 600 }}>
      LOADING VECTOR WORLD MODEL...
    </div>
  )
});

export default function Home() {
  const [locations, setLocations] = useState<TravelLocation[]>([]);
  const [autoRotate, setAutoRotate] = useState(false); // Defaulting to OFF based on your preference
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationTags, setLocationTags] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<TravelLocation | null>(null);

  const handleGlobeClick = (coords: { lat: number; lng: number }, countryName?: string) => {
    setSelectedLocation(null);
    setPendingCoords(coords);
    
    // Automatically fill the input with the clicked country name, or a fallback
    setLocationName(countryName || `Location at ${coords.lat.toFixed(2)}N`);
  };

  const handleMarkerClick = (location: TravelLocation) => {
    setPendingCoords(null);
    setSelectedLocation(location);
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords || !locationName.trim()) return;

    const tagsArray = locationTags
      .split(",")
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    const newLocation: TravelLocation = {
      id: crypto.randomUUID(),
      name: locationName.trim(),
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      tags: tagsArray,
      images: [],
      status: "want-to-go"
    };

    setLocations(prev => [...prev, newLocation]);
    setLocationName("");
    setLocationTags("");
    setPendingCoords(null);
  };

  const toggleVisitedStatus = (id: string) => {
    setLocations(prev =>
      prev.map(loc =>
        loc.id === id 
          ? { ...loc, status: loc.status === "want-to-go" ? "visited" : "want-to-go" }
          : loc
      )
    );
    setSelectedLocation(prev => 
      prev && prev.id === id 
        ? { ...prev, status: prev.status === "want-to-go" ? "visited" : "want-to-go" } 
        : prev
    );
  };

  return (
    <main style={{ position: 'relative', height: '100vh', width: '100vw', backgroundColor: '#121214', overflow: 'hidden' }}>
      
      {/* HUD Panel Layer */}
      <div style={{ position: 'absolute', top: '32px', left: '32px', zIndex: 10, pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>
          Explore
        </h1>
        <p style={{ margin: '4px 0 0 0', color: '#a1a1aa', fontSize: '13px', fontWeight: 500, fontFamily: 'sans-serif' }}>
          Click the planet to drop a pin • Drag to manual rotate
        </p>
      </div>

      {/* --- FLOATING CONFIGURATION SETTINGS PANEL --- */}
      <div style={{ position: 'absolute', bottom: '32px', left: '32px', zIndex: 10, display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setAutoRotate(prev => !prev)}
          style={{ backgroundColor: autoRotate ? '#3b82f6' : 'rgba(39, 39, 42, 0.8)', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 16px', color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif', backdropFilter: 'blur(4px)', transition: 'all 0.2s' }}
        >
          Auto-Spin: {autoRotate ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ width: '100%', height: '100%' }}>
        <EarthGlobe 
          locations={locations}
          autoRotate={autoRotate}
          onGlobeClick={handleGlobeClick}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* --- ADD LOCATION DIALOG --- */}
      {pendingCoords && (
        <div style={{ position: 'absolute', top: '32px', right: '32px', zIndex: 20, width: '320px', backgroundColor: 'rgba(24, 24, 27, 0.95)', border: '1px solid #3f3f46', borderRadius: '16px', padding: '24px', fontFamily: 'sans-serif', color: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800 }}>Drop Travel Pin</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace' }}>
            Coordinates: {pendingCoords.lat.toFixed(3)}N, {pendingCoords.lng.toFixed(3)}E
          </p>

          <form onSubmit={handleAddLocation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>Location Name</label>
              <input 
                type="text" 
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                style={{ backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px', color: '#ffffff', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>Categorisation Tags</label>
              <input 
                type="text" 
                value={locationTags}
                onChange={(e) => setLocationTags(e.target.value)}
                placeholder="e.g. scenic, culture, stadium" 
                style={{ backgroundColor: '#09090b', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px', color: '#ffffff', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button 
                type="button" 
                onClick={() => setPendingCoords(null)}
                style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                style={{ flex: 1, backgroundColor: '#f43f5e', border: 'none', borderRadius: '8px', padding: '10px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Pin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- PIN DETAIL INSPECTOR --- */}
      {selectedLocation && (
        <div style={{ position: 'absolute', top: '32px', right: '32px', zIndex: 20, width: '320px', backgroundColor: 'rgba(24, 24, 27, 0.95)', border: '1px solid #3f3f46', borderRadius: '16px', padding: '24px', fontFamily: 'sans-serif', color: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{selectedLocation.name}</h3>
          <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '4px 8px', borderRadius: '6px', backgroundColor: selectedLocation.status === 'visited' ? '#064e3b' : '#881337', color: selectedLocation.status === 'visited' ? '#10b981' : '#f43f5e' }}>
            {selectedLocation.status === 'visited' ? '✓ Destination Visited' : '○ Active Goal Tracker'}
          </span>

          {selectedLocation.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px', marginBottom: '14px' }}>
              {selectedLocation.tags.map(tag => (
                <span key={tag} style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#27272a', border: '1px solid #3f3f46', padding: '3px 10px', borderRadius: '6px', color: '#e4e4e7' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <button 
              onClick={() => toggleVisitedStatus(selectedLocation.id)}
              style={{ backgroundColor: selectedLocation.status === 'visited' ? '#27272a' : '#059669', border: 'none', borderRadius: '8px', padding: '12px', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              {selectedLocation.status === 'visited' ? 'Return to Wants List' : 'Mark as Visited Target'}
            </button>
            <button 
              onClick={() => setSelectedLocation(null)}
              style={{ backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '6px' }}
            >
              Close Panel
            </button>
          </div>
        </div>
      )}

    </main>
  );
}