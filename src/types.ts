export interface Apartment {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  imageUrl: string;
  features: string[];
}

export interface BookingDetails {
  apartmentId: string;
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  guestEmail: string;
}