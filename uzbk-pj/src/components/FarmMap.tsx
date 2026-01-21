"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = {
  lat: number;
  lng: number;
};

export type FarmMarker = {
  id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  detailUrl?: string;
  ratingAvg?: number | null;
  ratingCount?: number;
};

const DEFAULT_CENTER: LatLng = { lat: 37.5665, lng: 126.978 };
const LEAFLET_CSS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

declare global {
  interface Window {
    L?: any;
  }
}

const loadLeaflet = () =>
  new Promise<any>((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-leaflet]"
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L));
      existingScript.addEventListener("error", reject);
      return;
    }

    if (!document.querySelector("link[data-leaflet-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      link.setAttribute("data-leaflet-css", "true");
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.setAttribute("data-leaflet", "true");
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function FarmMap({
  center,
  farms,
  zoom = 13,
  radiusKm,
}: {
  center: LatLng | null;
  farms: FarmMarker[];
  zoom?: number;
  radiusKm?: number;
}) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        if (mapRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([center?.lat ?? DEFAULT_CENTER.lat, center?.lng ?? DEFAULT_CENTER.lng], zoom);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const markerLayer = L.layerGroup().addTo(map);
        mapRef.current = map;
        markersRef.current = markerLayer;
        setMapReady(true);
      })
      .catch(() => {
        // Ignore map load errors for now.
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.L) return;
    const L = window.L;
    const markerLayer = markersRef.current;

    if (center) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }

    if (markerLayer) {
      markerLayer.clearLayers();
    }

    if (center) {
      if (radiusKm && radiusKm > 0) {
        const radiusCircle = L.circle([center.lat, center.lng], {
          radius: radiusKm * 1000,
          color: "#ef4444",
          weight: 1,
          fillColor: "#fecaca",
          fillOpacity: 0.2,
        });
        markerLayer.addLayer(radiusCircle);
      }
      const meMarker = L.circleMarker([center.lat, center.lng], {
        radius: 6,
        color: "#111827",
        fillColor: "#111827",
        fillOpacity: 0.9,
      });
      meMarker.bindPopup("내 위치");
      markerLayer.addLayer(meMarker);
    }

    farms.forEach((farm) => {
      const marker = L.marker([farm.lat, farm.lng]);
      const safeName = escapeHtml(farm.name);
      const safeAddress = farm.address ? escapeHtml(farm.address) : "";
      const ratingHtml =
        farm.ratingAvg != null
          ? `<div style="margin-top:6px;font-size:12px;color:#111827;"><span style="color:#f59e0b;">★</span> ${farm.ratingAvg.toFixed(
              1
            )} <span style="color:#9ca3af;">(${farm.ratingCount ?? 0})</span></div>`
          : `<div style="margin-top:6px;font-size:12px;color:#6b7280;">리뷰 없음</div>`;
      const linkHtml = farm.detailUrl
        ? `<div style="margin-top:6px;"><a href="${farm.detailUrl}" style="color:#2563eb;text-decoration:underline;">농장 상품 보기</a></div>`
        : "";
      const popupText = safeAddress
        ? `${safeName}<br/>${safeAddress}${ratingHtml}${linkHtml}`
        : `${safeName}${ratingHtml}${linkHtml}`;
      marker.bindPopup(popupText);
      markerLayer.addLayer(marker);
    });
  }, [center, farms, zoom, radiusKm, mapReady]);

  return (
    <div className="h-full w-full overflow-hidden rounded-xl" ref={containerRef} />
  );
}
