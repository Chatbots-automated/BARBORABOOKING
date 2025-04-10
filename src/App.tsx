import React, { useState } from 'react';
import { Building } from 'lucide-react';
import { apartments } from './data/apartments';
import { ApartmentCard } from './components/ApartmentCard';
import { BookingForm } from './components/BookingForm';
import { Apartment } from './types';

function App() {
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-blue-600" />
            <h1 className="ml-3 text-2xl font-bold text-gray-900">Apartment Bookings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apartments.map((apartment) => (
            <ApartmentCard
              key={apartment.id}
              apartment={apartment}
              onSelect={setSelectedApartment}
            />
          ))}
        </div>
      </main>

      {selectedApartment && (
        <BookingForm
          apartment={selectedApartment}
          onClose={() => setSelectedApartment(null)}
        />
      )}
    </div>
  );
}

export default App;