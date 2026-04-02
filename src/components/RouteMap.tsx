import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, BorderRadius, FontSize } from '../theme/colors';
import NetworkService from '../services/NetworkService';

export interface MapCoordinate {
  lat: number;
  lng: number;
  stopName: string;
}

interface RouteMapProps {
  points: MapCoordinate[];
  height?: number;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function RouteMap({ points, height = 250 }: RouteMapProps): React.JSX.Element {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial network status
    setIsOnline(NetworkService.isConnected());

    // Subscribe to network changes
    const unsubscribe = NetworkService.onChange((online) => {
      setIsOnline(online);
      if (!online) {
        Alert.alert(
          '📡 No Internet',
          'Map requires an internet connection to display. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      }
    });

    return unsubscribe;
  }, []);

  const html = useMemo(() => {
    const safePoints = points.map((point) => ({
      ...point,
      stopName: escapeHTML(point.stopName),
    }));

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${JSON.stringify(safePoints)};
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (points.length > 0) {
      const latLngs = points.map(p => [p.lat, p.lng]);
      const polyline = L.polyline(latLngs, {
        color: '#667eea',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);

      points.forEach((point, index) => {
        const marker = L.circleMarker([point.lat, point.lng], {
          radius: index === 0 || index === points.length - 1 ? 7 : 5,
          color: index === 0 ? '#2e7d32' : (index === points.length - 1 ? '#d32f2f' : '#667eea'),
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 3,
        }).addTo(map);

        marker.bindPopup('<b>' + point.stopName + '</b>');
      });

      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else {
      map.setView([23.8103, 90.4125], 11);
    }
  </script>
</body>
</html>`;
  }, [points]);

  // Show offline warning
  if (!isOnline) {
    return (
      <View style={[styles.offlineContainer, { height }]}>
        <View style={styles.offlineContent}>
          <Ionicons name="wifi-off" size={48} color={Colors.warning} style={{ marginBottom: 12 }} />
          <Text style={styles.offlineTitle}>No Internet Connection</Text>
          <Text style={styles.offlineText}>Map requires an internet connection to display route and markers.</Text>
          <Text style={styles.offlineTip}>Please check your connection and try again.</Text>
        </View>
      </View>
    );
  }

  if (points.length < 2) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>Map not available for this route</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapContainer, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  offlineContainer: {
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderWidth: 1,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  offlineContent: {
    alignItems: 'center',
  },
  offlineTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  offlineTip: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
