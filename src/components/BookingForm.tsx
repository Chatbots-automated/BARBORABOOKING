import React, { useState, useEffect } from 'react';
import { format, differenceInDays, eachDayOfInterval } from 'date-fns';
import { Apartment, BookingDetails } from '../types';
import { supabase } from '../lib/supabase';

interface BookingFormProps {
  apartment: Apartment;
  onClose: () => void;
}

export function BookingForm({ apartment, onClose }: BookingFormProps) {
  const [bookingDetails, setBookingDetails] = useState<Partial<BookingDetails>>({
    apartmentId: apartment.id,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedDays, setBookedDays] = useState<Date[]>([]);

  useEffect(() => {
    async function fetchBookedDates() {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('check_in, check_out')
          .eq('apartment_name', apartment.name);


        if (error) throw error;

        // Generate all booked days
        const allBookedDays = data.flatMap(booking => 
          eachDayOfInterval({
            start: new Date(booking.check_in),
            end: new Date(booking.check_out)
          })
        );

        setBookedDays(allBookedDays);
      } catch (err) {
        console.error('Error fetching booked dates:', err);
      }
    }

    fetchBookedDates();
  }, [apartment.id]);

  const isDateBooked = (date: Date) => {
    return bookedDays.some(bookedDate => 
      format(bookedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const handleDateChange = (type: 'checkIn' | 'checkOut', date: Date) => {
    const newBookingDetails = { ...bookingDetails };
    
    if (type === 'checkIn') {
      if (isDateBooked(date)) {
        setError('This date is already booked');
        return;
      }
      newBookingDetails.checkIn = date;
      // Reset checkout if it's before checkin
      if (bookingDetails.checkOut && date >= bookingDetails.checkOut) {
        newBookingDetails.checkOut = undefined;
      }
    } else {
      if (isDateBooked(date)) {
        setError('This date is already booked');
        return;
      }
      newBookingDetails.checkOut = date;
    }

    // Check if any day in the range is booked
    if (newBookingDetails.checkIn && newBookingDetails.checkOut) {
      const daysToCheck = eachDayOfInterval({
        start: newBookingDetails.checkIn,
        end: newBookingDetails.checkOut
      });

      if (daysToCheck.some(date => isDateBooked(date))) {
        setError('Some days in this range are already booked');
        return;
      }
    }

    setBookingDetails(newBookingDetails);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (
        !bookingDetails.checkIn ||
        !bookingDetails.checkOut ||
        !bookingDetails.guestEmail ||
        !bookingDetails.guestName
      ) {
        throw new Error('Please fill in all required fields');
      }

      if (new Date(bookingDetails.checkOut) <= new Date(bookingDetails.checkIn)) {
        throw new Error('Check-out date must be after check-in date');
      }

      // Final check for booked days
      const daysToCheck = eachDayOfInterval({
        start: bookingDetails.checkIn,
        end: bookingDetails.checkOut
      });

      if (daysToCheck.some(date => isDateBooked(date))) {
        throw new Error('Some days in this range are already booked');
      }

      const numberOfNights = differenceInDays(
        new Date(bookingDetails.checkOut),
        new Date(bookingDetails.checkIn)
      );

      const totalPrice = numberOfNights * apartment.pricePerNight;
      const priceInCents = Math.round(totalPrice * 100);

      const params = new URLSearchParams({
        mode: 'payment',
        success_url: `${window.location.origin}/success`,
        cancel_url: `${window.location.origin}/cancel`,
        customer_email: bookingDetails.guestEmail || '',
        'line_items[0][price_data][currency]': 'eur',
        'line_items[0][price_data][product_data][name]': apartment.name,
        'line_items[0][price_data][unit_amount]': priceInCents.toString(),
        'line_items[0][quantity]': '1',
        'metadata[apartmentId]': apartment.id,
        'metadata[apartmentName]': apartment.name,
        'metadata[checkIn]': bookingDetails.checkIn.toISOString(),
        'metadata[checkOut]': bookingDetails.checkOut.toISOString(),
        'metadata[email]': bookingDetails.guestEmail || '',
        'metadata[guestName]': bookingDetails.guestName || '',
        'metadata[price]': totalPrice.toString(),
      });

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer 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`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const text = await response.text();

      if (!response.ok) {
        console.error('Stripe error:', text);
        throw new Error('Failed to create checkout session');
      }

      const session = JSON.parse(text);
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Book {apartment.name}</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Check-in Date</label>
            <input
              type="date"
              required
              min={format(new Date(), 'yyyy-MM-dd')}
              value={bookingDetails.checkIn ? format(bookingDetails.checkIn, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('checkIn', new Date(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Check-out Date</label>
            <input
              type="date"
              required
              min={bookingDetails.checkIn ? format(bookingDetails.checkIn, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
              value={bookingDetails.checkOut ? format(bookingDetails.checkOut, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateChange('checkOut', new Date(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              required
              onChange={(e) => setBookingDetails({
                ...bookingDetails,
                guestName: e.target.value
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              onChange={(e) => setBookingDetails({
                ...bookingDetails,
                guestEmail: e.target.value
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}