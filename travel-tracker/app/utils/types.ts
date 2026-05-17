/**
 * Represents a user-defined travel goal destination plotted on the map/globe.
 */
export interface TravelLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  notes?: string;
  images: string[]; // Array of image URLs or base64 data strings
  status: 'want-to-go' | 'visited';
}