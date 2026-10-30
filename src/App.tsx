// src/App.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Home,
  Map as MapIcon,
  PackageOpen,
  BarChart3,
  PlusCircle,
  Search,
  LocateFixed,
  Store,
  ShoppingBag,
} from 'lucide-react';
import { useEcoStore } from './store/useEcoStore';
import { SurplusCard } from './components/dashboard/SurplusCard';
import { LiveStreetMap } from './components/dashboard/LiveStreetMap';
import { PostListingForm } from './components/dashboard/PostListingForm';
import { MyClaimsView } from './components/dashboard/MyClaimsView';
import { ImpactAnalyticsView } from './components/analytics/ImpactAnalyticsView';
import { QrHandoffModal } from './components/modals/QrHandoffModal';
import { EcoLoopLogo } from './components/common/EcoLoopLogo';
import {
  requestBrowserGps,
  reverseGeocode,
  searchAddressCoordinates,
  calculateDistanceKm,
} from './utils/geoUtils';
import type { FoodCategory } from './types';

export function App() {
  const {
    initializeStore,
    isInitialized,
    isLiveConnected,
    activeTab,
    setActiveTab,
    activeRole,
    setActiveRole,
    userLocation,
    locationLabel,
    setUserLocation,
    setLocationError,
    claims,
    claimListing,
    getFilteredListings,
    filters,
    setCategoryFilter,
    setSearchQuery,
    sweepExpiredListings,
  } = useEcoStore();

  const [viewMode, setViewMode] = useState<'listings' | 'map'>('listings');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [customCityQuery, setCustomCityQuery] = useState<string>('');

  useEffect(() => {
    initializeStore();
    detectLiveGpsLocation();

    const sweepTimer = setInterval(() => {
      sweepExpiredListings();
    }, 10000);
    return () => clearInterval(sweepTimer);
  }, []);

  const detectLiveGpsLocation = async () => {
    setIsLocating(true);
    try {
      const coords = await requestBrowserGps();
      const resolved = await reverseGeocode(coords);
      setUserLocation({ lat: resolved.lat, lng: resolved.lng }, resolved.cityOrArea);
    } catch (err) {
      setLocationError(
        err instanceof Error ? err.message : 'Location permission needed'
      );
      setUserLocation({ lat: 0, lng: 0 }, 'Set Your Location');
    } finally {
      setIsLocating(false);
    }
  };

  const handleManualLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCityQuery.trim()) return;
    setIsLocating(true);
    const result = await searchAddressCoordinates(customCityQuery);
    setIsLocating(false);
    if (result) {
      setUserLocation({ lat: result.lat, lng: result.lng }, result.cityOrArea);
      setShowLocationPicker(false);
      setCustomCityQuery('');
    }
  };

  const rawFilteredListings = getFilteredListings();
  const liveListings = useMemo(() => {
    return rawFilteredListings
      .map((item) => {
        const hasValidUserCoords =
          userLocation && (userLocation.lat !== 0 || userLocation.lng !== 0);
        const distanceKm = hasValidUserCoords
          ? calculateDistanceKm(userLocation, {
              lat: item.location.lat,
              lng: item.location.lng,
            })
          : undefined;

        return {
          ...item,
          location: {
            ...item.location,
            distanceKm,
          },
        };
      })
      .sort((a, b) => (a.location.distanceKm ?? 9999) - (b.location.distanceKm ?? 9999));
  }, [rawFilteredListings, userLocation]);

  const pendingClaimsCount = claims.filter(
    (c) => c.status === 'pending_pickup'
  ).length;

  const handleRescueClaim = async (listingId: string) => {
    const claim = await claimListing(listingId);
    if (claim) {
      setActiveTab('claims');
    }
  };

  // Determine map center: either user's live GPS, or the first active listing, or world view
  const activeMapCenter = useMemo(() => {
    if (userLocation && (userLocation.lat !== 0 || userLocation.lng !== 0)) {
      return userLocation;
    }
    if (liveListings.length > 0) {
      return {
        lat: liveListings[0].location.lat,
        lng: liveListings[0].location.lng,
      };
    }
    return { lat: 20.0, lng: 0.0 };
  }, [userLocation, liveListings]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#061411] text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-emerald-400 font-semibold text-sm">
          <EcoLoopLogo size={32} />
          <span>Loading EcoLoop...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#07221B] via-[#081514] to-[#090D16] text-slate-100 pb-24 lg:pb-12">
      <div className="fixed top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Responsive Header */}
      <header className="sticky top-0 z-30 bg-[#071A15]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <EcoLoopLogo size={36} />
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">
                  Eco<span className="text-emerald-400">Loop</span>
                </h1>
                <span className="text-[10px] text-emerald-300/80 font-medium tracking-wider uppercase flex items-center gap-1 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {isLiveConnected ? 'Live Cloud Sync' : 'Local Offline Mode'}
                </span>
                <span className="text-[10px] text-emerald-300/80 font-medium tracking-wider uppercase block mt-0.5">
                  Surplus Food Network
                </span>
              </div>
            </button>

            {/* Real Location Badge & Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationPicker((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="max-w-[140px] sm:max-w-[200px] truncate">
                  {locationLabel}
                </span>
                <LocateFixed
                  className={`w-3.5 h-3.5 text-emerald-400 ml-0.5 shrink-0 ${
                    isLocating ? 'animate-spin' : ''
                  }`}
                />
              </button>

              {showLocationPicker && (
                <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-[#0D1916] border border-emerald-500/40 p-3 shadow-2xl z-50 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      detectLiveGpsLocation();
                      setShowLocationPicker(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5" /> Detect My Exact GPS
                  </button>
                  <form onSubmit={handleManualLocationSearch} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Or enter city / area..."
                      value={customCityQuery}
                      onChange={(e) => setCustomCityQuery(e.target.value)}
                      className="flex-1 rounded-xl bg-black/50 border border-white/15 px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Set
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-black/35 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'browse'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" /> Marketplace
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('claims')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'claims'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <PackageOpen className="w-3.5 h-3.5" /> My Pickups
              {pendingClaimsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {pendingClaimsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Impact
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('post')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'post'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" /> List Surplus Food
            </button>
          </nav>

          {/* Role Mode Switcher */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveRole(activeRole === 'donor' ? 'receiver' : 'donor')
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
            >
              {activeRole === 'donor' ? (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Store Partner</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Consumer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'browse' && (
          <div className="space-y-5">
            {/* Search & Category Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#101B18]/85 border border-emerald-500/25 p-3.5 rounded-2xl backdrop-blur-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search stores, food items, or streets..."
                  value={filters.searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/15 pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {(
                  [
                    'all',
                    'produce',
                    'bakery',
                    'prepared_meals',
                    'dairy',
                    'pantry',
                  ] as (FoodCategory | 'all')[]
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize shrink-0 transition-all cursor-pointer ${
                      filters.category === cat
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Toggle */}
            <div className="grid grid-cols-2 p-1 rounded-full bg-[#111C19]/90 border border-white/15 lg:hidden">
              <button
                type="button"
                onClick={() => setViewMode('listings')}
                className={`py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'listings'
                    ? 'bg-[#2A3733] text-white shadow-inner border border-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Listings ({liveListings.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-[#2A3733] text-white shadow-inner border border-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Map
              </button>
            </div>

            {/* Responsive Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div
                className={`lg:col-span-7 space-y-3.5 ${
                  viewMode === 'map' ? 'hidden lg:block' : 'block'
                }`}
              >
                {liveListings.length === 0 ? (
                  <div className="rounded-2xl bg-[#101B18]/85 border border-emerald-500/25 p-10 text-center space-y-3">
                    <Store className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                    <h3 className="text-base font-bold text-white">
                      No Active Surplus Listings Nearby
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Local bakeries, grocery stores, and restaurants can publish unsold surplus inventory in real time.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('post')}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Publish First Listing
                    </button>
                  </div>
                ) : (
                  liveListings.map((listing) => (
                    <SurplusCard
                      key={listing.id}
                      listing={listing}
                      onClaim={handleRescueClaim}
                    />
                  ))
                )}
              </div>

              <div
                className={`lg:col-span-5 lg:sticky lg:top-24 ${
                  viewMode === 'listings' ? 'hidden lg:block' : 'block'
                }`}
              >
                <LiveStreetMap
                  listings={liveListings}
                  userLocation={activeMapCenter}
                  onClaim={handleRescueClaim}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'post' && (
          <div className="max-w-2xl mx-auto">
            <PostListingForm />
          </div>
        )}

        {activeTab === 'claims' && (
          <div className="max-w-3xl mx-auto">
            <MyClaimsView />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-4xl mx-auto">
            <ImpactAnalyticsView />
          </div>
        )}
      </main>

      {/* Mobile Navigation Dock */}
      <nav className="lg:hidden fixed bottom-4 inset-x-4 max-w-md mx-auto h-16 rounded-3xl bg-[#131D1B]/95 backdrop-blur-2xl border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.65)] px-3 flex items-center justify-around z-30">
        <button
          type="button"
          onClick={() => {
            setActiveTab('browse');
            setViewMode('listings');
          }}
          className={`flex flex-col items-center justify-center w-14 h-full cursor-pointer ${
            activeTab === 'browse' && viewMode === 'listings'
              ? 'text-emerald-400'
              : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('browse');
            setViewMode('map');
          }}
          className={`flex flex-col items-center justify-center w-14 h-full cursor-pointer ${
            activeTab === 'browse' && viewMode === 'map'
              ? 'text-emerald-400'
              : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Map</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={`flex flex-col items-center justify-center w-14 h-full cursor-pointer ${
            activeTab === 'claims' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            <PackageOpen className="w-5 h-5" />
            {pendingClaimsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                {pendingClaimsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium mt-1">Pickups</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center w-14 h-full cursor-pointer ${
            activeTab === 'analytics' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Impact</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('post')}
          className={`flex flex-col items-center justify-center w-14 h-full cursor-pointer ${
            activeTab === 'post' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Publish</span>
        </button>
      </nav>

      <QrHandoffModal />
    </div>
  );
}

export default App;