import React, { useState } from 'react';
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isWithinInterval,
  isBefore,
  isPast
} from 'date-fns';
import { lt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info, X, Tag, Loader2, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface BookingCalendarProps {
  bookedDates: Date[];
  checkIn: Date | null;
  checkOut: Date | null;
  onDateSelect: (date: Date) => void;
  onRulesAcceptanceChange?: (accepted: boolean) => void;
  onCouponApply?: (coupon: { code: string; discount_percent: number } | null) => void;
}

export function BookingCalendar({
  bookedDates,
  checkIn,
  checkOut,
  onDateSelect,
  onRulesAcceptanceChange,
  onCouponApply
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showError, setShowError] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percent: number } | null>(null);
  const today = new Date();
  const { language, t } = useLanguage();

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const allDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const isDateBooked = (date: Date) => {
    return bookedDates.some(bookedDate => isSameDay(bookedDate, date));
  };

  const isInRange = (date: Date) => {
    if (!checkIn || !checkOut) return false;
    return isWithinInterval(date, { start: checkIn, end: checkOut });
  };

  const weekDays = language === 'en' 
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['P', 'A', 'T', 'K', 'P', 'Š', 'S'];

  const formatCapitalizedMonth = (date: Date) => {
    const raw = format(date, 'LLLL yyyy', { locale: language === 'lt' ? lt : undefined });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const handleRulesAcceptanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRulesAccepted(e.target.checked);
    setShowError(false);
    if (onRulesAcceptanceChange) {
      onRulesAcceptanceChange(e.target.checked);
    }
  };

  const handleDateSelect = (date: Date) => {
    if (!rulesAccepted) {
      setShowError(true);
      return;
    }
    onDateSelect(date);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError(t('please.enter.coupon'));
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim())
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;

      if (data) {
        setAppliedCoupon(data);
        if (onCouponApply) {
          onCouponApply(data);
        }
        setCouponError(null);
      } else {
        setCouponError(t('coupon.invalid'));
        setAppliedCoupon(null);
        if (onCouponApply) {
          onCouponApply(null);
        }
      }
    } catch (err) {
      console.error('Error validating coupon:', err);
      setCouponError(t('coupon.invalid'));
      setAppliedCoupon(null);
      if (onCouponApply) {
        onCouponApply(null);
      }
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  if (showRules) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-8 max-w-3xl w-full shadow-2xl relative my-8">
          <button
            onClick={() => setShowRules(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('house.rules')}</h2>

          <div className="prose prose-sm max-w-none overflow-y-auto max-h-[70vh] pr-4">
            <h3 className="text-xl font-bold mb-4">{t('rules.title')}</h3>
            <p className="mb-6">{t('rules.intro')}</p>

            <div className="mb-6">
              <p className="font-semibold">{t('check.in.time')}</p>
              <p className="font-semibold">{t('check.out.time')}</p>
            </div>

            <p className="mb-6">{t('payment.note')}</p>

            <h3 className="text-lg font-bold mb-4">{t('cancellation.title')}</h3>
            <p className="mb-6">{t('cancellation.rules')}</p>

            <h3 className="text-lg font-bold mb-4">{t('pets.title')}</h3>
            <p className="mb-6">{t('pets.rules')}</p>

            <h3 className="text-lg font-bold mb-4">{t('prohibited.title')}</h3>
            <ul className="list-disc pl-5 mb-6">
              {t('prohibited.rules').map((rule: string, index: number) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>

            <h3 className="text-lg font-bold mb-4">{t('fire.safety.title')}</h3>
            <ul className="list-disc pl-5 mb-6">
              {t('fire.safety.rules').map((rule: string, index: number) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>

            <h3 className="text-lg font-bold mb-4">{t('guest.responsibility.title')}</h3>
            <ul className="list-disc pl-5 mb-6">
              {t('guest.responsibility.rules').map((rule: string, index: number) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>

            <h3 className="text-lg font-bold mb-4">{t('sauna.rules.title')}</h3>
            <ul className="list-disc pl-5 mb-6">
              {t('sauna.rules').map((rule: string, index: number) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>

            <h3 className="text-lg font-bold mb-4">{t('sauna.prohibited.title')}</h3>
            <ul className="list-disc pl-5 mb-6">
              {t('sauna.prohibited.rules').map((rule: string, index: number) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>

            <p className="mb-6">{t('liability.note')}</p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowRules(false)}
              className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-xl font-medium transition-colors"
            >
              {t('back.to.booking')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {formatCapitalizedMonth(currentMonth)}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-600">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, index) => (
          <div key={`empty-${index}`} className="h-10" />
        ))}

        {allDays.map(day => {
          const isBooked = isDateBooked(day);
          const isPastDate = isPast(day) && !isSameDay(day, today);
          const isCheckIn = checkIn && isSameDay(day, checkIn);
          const isCheckOut = checkOut && isSameDay(day, checkOut);
          const isInDateRange = isInRange(day);
          const isCurrentDay = isToday(day);
          const isAvailable = !isBooked && !isPastDate;

          let className = `
            h-10 rounded-lg flex items-center justify-center text-sm relative
            ${isPastDate ? 'text-gray-300 cursor-not-allowed' : ''}
            ${isBooked ? 'bg-red-100 text-red-600 cursor-not-allowed' : ''}
            ${isAvailable && !isCheckIn && !isCheckOut ? 'text-green-600 hover:bg-green-50 cursor-pointer' : ''}
            ${isCheckIn ? 'bg-[#807730] text-white hover:bg-[#6a632a]' : ''}
            ${isCheckOut ? 'bg-[#807730] text-white hover:bg-[#6a632a]' : ''}
            ${isInDateRange ? 'bg-green-100' : ''}
            ${isCurrentDay ? 'font-bold' : ''}
          `;

          if (isCheckIn) {
            className += ` after:content-["${t('arrival')}"] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:text-xs after:whitespace-nowrap after:mt-1`;
          }
          if (isCheckOut) {
            className += ` after:content-["${t('departure')}"] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:text-xs after:whitespace-nowrap after:mt-1`;
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isBooked && !isPastDate && handleDateSelect(day)}
              disabled={isBooked || isPastDate}
              className={className}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="mt-8 space-y-4">
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 rounded" />
            <span className="text-sm text-gray-600">{t('booked')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded" />
            <span className="text-sm text-gray-600">{t('available')}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              setCouponError(null);
            }}
            placeholder={t('enter.coupon')}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={validateCoupon}
            disabled={isValidatingCoupon}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
          >
            {isValidatingCoupon ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Tag className="w-5 h-5" />
            )}
          </button>
        </div>

        {couponError && (
          <p className="text-red-500 text-sm">{couponError}</p>
        )}

        {appliedCoupon && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{t('coupon.applied')} ({appliedCoupon.discount_percent}%)</span>
          </div>
        )}

        <div className="flex items-start gap-3 pt-4 border-t border-gray-200">
          <input
            type="checkbox"
            id="rules-acceptance"
            checked={rulesAccepted}
            onChange={handleRulesAcceptanceChange}
            className={`mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary ${
              showError ? 'border-red-500' : ''
            }`}
          />
          <div>
            <label htmlFor="rules-acceptance" className={`text-gray-700 font-medium ${
              showError ? 'text-red-500' : ''
            }`}>
              {t('rules.acceptance')}
            </label>
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="block text-sm text-primary hover:text-primary-dark mt-1 flex items-center gap-1"
            >
              <Info className="w-4 h-4" />
              {t('view.rules')}
            </button>
            {showError && (
              <p className="text-red-500 text-sm mt-1">
                {t('please.accept.rules')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}