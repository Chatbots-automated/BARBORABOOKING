import React from 'react';
import { Home, Calendar, ChevronRight } from 'lucide-react';
import { Apartment } from '../types';

interface ApartmentCardProps {
  apartment: Apartment;
  onSelect: (apartment: Apartment) => void;
}

export function ApartmentCard({ apartment, onSelect }: ApartmentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <img 
        src={apartment.imageUrl} 
        alt={apartment.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{apartment.name}</h3>
          <span className="text-lg font-bold text-green-600">
            ${apartment.pricePerNight}/night
          </span>
        </div>
        <p className="text-gray-600 mb-4">{apartment.description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {apartment.features.map((feature) => (
            <span 
              key={feature}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600"
            >
              {feature}
            </span>
          ))}
        </div>
        <button
          onClick={() => onSelect(apartment)}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Calendar size={20} />
          Book Now
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}