import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, differenceInDays, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { Calendar, Tag, X } from 'lucide-react';
import { Apartment, BookingDetails, Coupon } from '../types';
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
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Function to extract the base apartment name
  const getApartmentBaseName = (fullName: string): string => {
    const nameMap: { [key: string]: string } = {
      'Senovinis medinis namas "Gintaras"': 'gintaras',
      'Dvivietis apartamentas "Pikulas"': 'pikulas',
      'Šeimyninis apartamentas "Māra"': 'mara',
      'Namelis dviems "Medeinė"': 'medeine'
    };
    return nameMap[fullName] || fullName.toLowerCase();
  };

  useEffect(() => {
    async function fetchBookedDates() {
      try {
        const baseName = getApartmentBaseName(apartment.name);
        const { data, error } = await supabase
          .from('bookings')
          .select('check_in, check_out')
          .eq('apartment_name', baseName);

        if (error) throw error;

        const allDates: Date[] = [];

        data.forEach(booking => {
          const start = parseISO(booking.check_in);
          const end = parseISO(booking.check_out);
          const daysInRange = eachDayOfInterval({ start, end });
          allDates.push(...daysInRange);
        });

        const uniqueDates = Array.from(
          new Set(allDates.map(date => format(date, 'yyyy-MM-dd')))
        ).map(dateStr => parseISO(dateStr));

        setBookedDates(uniqueDates);
      } catch (err) {
        console.error('Error fetching booked dates:', err);
        setError('Failed to fetch available dates');
      }
    }

    fetchBookedDates();
  }, [apartment.name]);

  const validateCoupon = async (code: string) => {
    setIsValidatingCoupon(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;

      if (data) {
        setAppliedCoupon(data as Coupon);
        return true;
      }

      setError('Invalid or expired coupon code');
      setAppliedCoupon(null);
      return false;
    } catch (err) {
      console.error('Error validating coupon:', err);
      setError('Failed to validate coupon');
      setAppliedCoupon(null);
      return false;
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }
    await validateCoupon(couponCode.trim());
  };

  const isDateBooked = (date: Date) => {
    return bookedDates.some(bookedDate => isSameDay(bookedDate, date));
  };

  const handleDateChange = (type: 'checkIn' | 'checkOut', date: Date | null) => {
    if (!date) return;

    const newBookingDetails = { ...bookingDetails };

    if (type === 'checkIn') {
      if (isDateBooked(date)) {
        setError('This date is already booked');
        return;
      }
      newBookingDetails.checkIn = date;
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

    if (newBookingDetails.checkIn && newBookingDetails.checkOut) {
      const daysToCheck = eachDayOfInterval({
        start: newBookingDetails.checkIn,
        end: newBookingDetails.checkOut,
      });

      if (daysToCheck.some(date => isDateBooked(date))) {
        setError('Some days in this range are already booked');
        return;
      }
    }

    setBookingDetails(newBookingDetails);
    setError(null);
  };

  const calculateTotalPrice = (numberOfNights: number) => {
    let totalPrice = numberOfNights * apartment.price_per_night;

    if (appliedCoupon) {
      const discount = totalPrice * (appliedCoupon.discount_percent / 100);
      totalPrice -= discount;
    }

    return totalPrice;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { checkIn, checkOut, guestEmail, guestName } = bookingDetails;

      if (!checkIn || !checkOut || !guestEmail || !guestName) {
        throw new Error('Please fill in all required fields');
      }

      if (checkOut <= checkIn) {
        throw new Error('Check-out date must be after check-in date');
      }

      const daysToCheck = eachDayOfInterval({ start: checkIn, end: checkOut });

      if (daysToCheck.some(date => isDateBooked(date))) {
        throw new Error('Some days in this range are already booked');
      }

      const numberOfNights = differenceInDays(checkOut, checkIn);
      const totalPrice = calculateTotalPrice(numberOfNights);
      const priceInCents = Math.round(totalPrice * 100);

      const params = new URLSearchParams({
        mode: 'payment',
        success_url: `${window.location.origin}/success`,
        cancel_url: `${window.location.origin}/cancel`,
        customer_email: guestEmail,
        'line_items[0][price_data][currency]': 'eur',
        'line_items[0][price_data][product_data][name]': apartment.name,
        'line_items[0][price_data][unit_amount]': priceInCents.toString(),
        'line_items[0][quantity]': '1',
        'metadata[apartmentId]': apartment.id,
        'metadata[apartmentName]': getApartmentBaseName(apartment.name),
        'metadata[checkIn]': checkIn.toISOString(),
        'metadata[checkOut]': checkOut.toISOString(),
        'metadata[email]': guestEmail,
        'metadata[guestName]': guestName,
        'metadata[price]': totalPrice.toString(),
      });

      if (appliedCoupon) {
        params.append('metadata[couponCode]', appliedCoupon.code);
        params.append('metadata[discountPercent]', appliedCoupon.discount_percent.toString());
      }

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

  const numberOfNights = bookingDetails.checkIn && bookingDetails.checkOut
    ? differenceInDays(bookingDetails.checkOut, bookingDetails.checkIn)
    : 0;

  const totalPrice = calculateTotalPrice(numberOfNights);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Book {apartment.name}</h2>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Date
              </label>
              <DatePicker
                selected={bookingDetails.checkIn}
                onChange={(date) => handleDateChange('checkIn', date)}
                minDate={new Date()}
                excludeDates={bookedDates}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholderText="Select date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-out Date
              </label>
              <DatePicker
                selected={bookingDetails.checkOut}
                onChange={(date) => handleDateChange('checkOut', date)}
                minDate={bookingDetails.checkIn || new Date()}
                excludeDates={bookedDates}
                dateFormat="MMM d, yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholderText="Select date"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={bookingDetails.guestName || ''}
              onChange={(e) => setBookingDetails({ ...bookingDetails, guestName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={bookingDetails.guestEmail || ''}
              onChange={(e) => setBookingDetails({ ...bookingDetails, guestEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter coupon code"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={isValidatingCoupon}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              <Tag className="w-5 h-5" />
            </button>
          </div>

          {appliedCoupon && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              Coupon applied: {appliedCoupon.discount_percent}% discount
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Price per night</span>
              <span className="font-medium">€{apartment.price_per_night}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Number of nights</span>
              <span className="font-medium">{numberOfNights}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center mb-2 text-green-600">
                <span>Discount ({appliedCoupon.discount_percent}%)</span>
                <span>-€{(numberOfNights * apartment.price_per_night * (appliedCoupon.discount_percent / 100)).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span>€{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Book Now'}
          </button>
        </form>
      </div>
    </div>
  );
}