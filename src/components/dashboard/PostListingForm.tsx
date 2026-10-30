// src/components/dashboard/PostListingForm.tsx
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Leaf,
  Utensils,
  Clock,
  MapPin,
  LocateFixed,
  Store,
  Search,
  AlertCircle,
  Camera,
  Trash2,
} from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';
import type { FoodCategory, DietaryTag, DonorProfile } from '../../types';
import { calculateListingImpact } from '../../db/database';
import { compressFoodImage } from '../../utils/imageUtils';
import {
  type Coordinates,
  requestBrowserGps,
  reverseGeocode,
  searchAddressCoordinates,
} from '../../utils/geoUtils';

const CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: 'produce', label: '🥬 Fresh Produce & Vegetables' },
  { value: 'bakery', label: '🥐 Bakery & Breads' },
  { value: 'prepared_meals', label: '🍲 Prepared Meals & Catering' },
  { value: 'dairy', label: '🥛 Dairy & Chilled Goods' },
  { value: 'pantry', label: '🛍️ Packaged Pantry Items' },
];

const BUSINESS_TYPES: DonorProfile['businessType'][] = [
  'Grocery',
  'Bakery',
  'Restaurant',
  'Cafe',
  'Community Fridge',
];

const DIETARY_OPTIONS: { value: DietaryTag; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'nut_free', label: 'Nut-Free' },
];

export const PostListingForm: React.FC = () => {
  const { addListing, userLocation, locationLabel, userName, setUserName } =
    useEcoStore();

  const [donorName, setDonorName] = useState(userName || '');
  const [donorType, setDonorType] =
    useState<DonorProfile['businessType']>('Grocery');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FoodCategory>('produce');
  const [weightKg, setWeightKg] = useState<number>(3.0);
  const [expiryHours, setExpiryHours] = useState<number>(4.0);
  const [pickupWindow, setPickupWindow] = useState('Today before closing');
  const [storageRequirement, setStorageRequirement] = useState<
    'ambient' | 'refrigerated' | 'frozen'
  >('ambient');
  const [selectedTags, setSelectedTags] = useState<DietaryTag[]>([]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Real Location State for the Store
  const [coords, setCoords] = useState<Coordinates | null>(userLocation);
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    setFormError(null);
    try {
      const compressed = await compressFoodImage(file);
      setImageUrl(compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to process photo');
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    if (userLocation && !coords) {
      setCoords(userLocation);
      setNeighborhood(locationLabel);
    }
  }, [userLocation, locationLabel, coords]);

  const { co2SavedKg, estimatedMeals } = calculateListingImpact(weightKg);

  const handleUseCurrentGps = async () => {
    setIsLocating(true);
    setFormError(null);
    try {
      const liveCoords = await requestBrowserGps();
      const resolved = await reverseGeocode(liveCoords);
      setCoords({ lat: resolved.lat, lng: resolved.lng });
      setAddress(resolved.displayName);
      setNeighborhood(resolved.cityOrArea);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Could not detect GPS. Please search your address below.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchAddress = async () => {
    if (!addressSearchQuery.trim()) return;
    setIsLocating(true);
    setFormError(null);
    const result = await searchAddressCoordinates(addressSearchQuery);
    setIsLocating(false);

    if (!result) {
      setFormError('Could not find coordinates for that address. Try a nearby landmark or city.');
      return;
    }

    setCoords({ lat: result.lat, lng: result.lng });
    setAddress(result.displayName);
    setNeighborhood(result.cityOrArea);
  };

  const toggleTag = (tag: DietaryTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!donorName.trim()) {
      setFormError('Please enter your store or organization name.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please enter a title for the surplus food listing.');
      return;
    }
    if (!coords) {
      setFormError(
        'Please set your store location using GPS or the address search bar.'
      );
      return;
    }

    setUserName(donorName.trim());

    await addListing({
      donorName,
      donorType,
      title,
      description,
      category,
      dietaryTags: selectedTags,
      weightKg,
      expiryHours,
      pickupWindow,
      storageRequirement,
      address: address || neighborhood || 'Verified Store Location',
      neighborhood: neighborhood || 'Local Area',
      coordinates: coords,
      imageUrl,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-[#101B18]/90 backdrop-blur-xl border border-emerald-500/35 p-6 shadow-[0_0_25px_rgba(16,185,129,0.12)] space-y-5"
    >
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Store className="w-5 h-5 text-emerald-400" />
          Publish Surplus Inventory
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          List unsold, safe-to-eat surplus food for immediate local pickup.
        </p>
      </div>

      {formError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Store Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Store / Business Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Sunrise Artisan Bakery"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Business Type
          </label>
          <select
            value={donorType}
            onChange={(e) =>
              setDonorType(e.target.value as DonorProfile['businessType'])
            }
            className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
          >
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Item Details */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Surplus Item Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g., 10x Assorted Sourdough Loaves & Baguettes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Food Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodCategory)}
              className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Storage Handling
            </label>
            <select
              value={storageRequirement}
              onChange={(e) =>
                setStorageRequirement(
                  e.target.value as 'ambient' | 'refrigerated' | 'frozen'
                )
              }
              className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ambient">Ambient / Room Temp</option>
              <option value="refrigerated">Refrigerated (Chilled)</option>
              <option value="frozen">Frozen</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Contents & Pickup Instructions *
          </label>
          <textarea
            rows={2}
            required
            placeholder="Specify quantity, packaging, allergen notes, and which counter to ask at..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        {/* Real Food Photo Capture / Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Food Photo (Camera or Upload)
          </label>
          {imageUrl ? (
            <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-emerald-400/50 shadow-md">
              <img
                src={imageUrl}
                alt="Surplus food preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(undefined)}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/75 text-rose-400 hover:text-rose-300 cursor-pointer"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-black/35 hover:bg-black/50 border border-dashed border-emerald-500/40 text-xs font-semibold text-emerald-300 cursor-pointer transition-colors">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>
                {isUploadingImage
                  ? 'Compressing photo...'
                  : 'Take Photo or Upload Image'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Quantity, Expiry & Pickup Window */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Total Weight (kg)
          </label>
          <input
            type="number"
            min="0.5"
            max="500"
            step="0.5"
            required
            value={weightKg}
            onChange={(e) =>
              setWeightKg(Math.max(0.5, parseFloat(e.target.value) || 0.5))
            }
            className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 text-sm font-mono text-emerald-400 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
          <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Valid For (Hours)
          </label>
          <input
            type="number"
            min="0.5"
            max="48"
            step="0.5"
            required
            value={expiryHours}
            onChange={(e) =>
              setExpiryHours(Math.max(0.5, parseFloat(e.target.value) || 1))
            }
            className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 text-sm font-mono text-amber-300 focus:border-emerald-400 focus:outline-none"
          />
        </div>

        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Pickup Window Note
          </label>
          <input
            type="text"
            placeholder="e.g., 18:00 - 21:00"
            value={pickupWindow}
            onChange={(e) => setPickupWindow(e.target.value)}
            className="w-full rounded-lg bg-slate-900 border border-white/15 px-3 py-1.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Store Geolocation Section */}
      <div className="p-4 rounded-xl bg-black/35 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Store Pickup Location *
            </h3>
            <p className="text-[11px] text-slate-400">
              Pin your exact coordinates so nearby consumers can navigate to you.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={isLocating}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-300 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <LocateFixed
              className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`}
            />
            Use My Live GPS
          </button>
        </div>

        {/* Address Geocode Lookup */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Or search street/city name to find coordinates..."
            value={addressSearchQuery}
            onChange={(e) => setAddressSearchQuery(e.target.value)}
            className="flex-1 rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSearchAddress}
            disabled={isLocating}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" /> Find
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              required
              placeholder="Street address & building number"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Neighborhood / City *
            </label>
            <input
              type="text"
              required
              placeholder="City or district"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        {coords && (
          <p className="text-[11px] text-emerald-400 font-mono">
            ✓ Verified GPS Pin: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
      </div>

      {/* Dietary Tags */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Dietary & Allergen Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_OPTIONS.map((tag) => {
            const active = selectedTags.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculated Impact Summary Footer */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/25 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
          <Leaf className="w-4 h-4" /> Estimated Impact: {co2SavedKg} kg CO₂e prevented
        </span>
        <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Utensils className="w-4 h-4 text-emerald-400" /> ~{estimatedMeals} meals
        </span>
      </div>

      <button
        type="submit"
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold text-sm tracking-wide uppercase shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:brightness-110 flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <PlusCircle className="w-4 h-4" /> Publish Live Listing
      </button>
    </form>
  );
};