#!/bin/bash

CLEAR_CACHE=false
if [[ "$1" == "--clear" || "$1" == "-c" ]]; then
  CLEAR_CACHE=true
fi

# Kill any stale Expo/Metro processes (but NOT all node processes)
echo "Stopping any existing Expo server..."
pkill -f "expo start" 2>/dev/null
pkill -f "metro" 2>/dev/null
sleep 1

# Auto-detect local IP (tries WiFi interfaces in order)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || \
           ipconfig getifaddr en1 2>/dev/null || \
           ipconfig getifaddr en2 2>/dev/null)

# Detect iPhone personal hotspot subnet (172.20.10.x) — phone can't reach Mac through its own hotspot
IS_HOTSPOT=false
if [[ "$LOCAL_IP" =~ ^172\.20\.10\. ]]; then
  IS_HOTSPOT=true
fi

EXTRA_FLAGS=""
if [ "$CLEAR_CACHE" = true ]; then
  EXTRA_FLAGS="--clear"
  echo "Clearing Metro cache..."
  rm -rf /tmp/pillo-metro-cache 2>/dev/null
fi

if [ -z "$LOCAL_IP" ] || [ "$IS_HOTSPOT" = true ]; then
  if [ "$IS_HOTSPOT" = true ]; then
    echo "⚠️  iPhone hotspot detected ($LOCAL_IP) — using tunnel mode."
  else
    echo "No local IP found — using tunnel mode."
  fi
  npx expo start --tunnel $EXTRA_FLAGS
  exit 0
fi

echo "IP: $LOCAL_IP — starting on LAN"
echo "Make sure your phone is on the same WiFi network."
export REACT_NATIVE_PACKAGER_HOSTNAME=$LOCAL_IP
npx expo start --lan $EXTRA_FLAGS
