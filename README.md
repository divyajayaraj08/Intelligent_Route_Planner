# SmartRoute

SmartRoute is a React/Vite and Express application for arbitrary-place search, road routing, optional live traffic-aware optimization, and route history. Place suggestions use OpenStreetMap Nominatim through the backend. With a TomTom key configured, selected coordinates are routed through TomTom Orbis Routing API v3 using live traffic and alternatives; otherwise standard OSRM routing is used and labeled as non-live. Dijkstra and A* remain limited to the synthetic graph demo mode.

## Architecture and prerequisites

- `client/`: React 19, Vite, Tailwind CSS, React Leaflet, Axios.
- `server/`: Node.js, Express, Mongoose, Nominatim geocoding, TomTom live-traffic and OSRM standard-routing adapters, Dijkstra/A* demo algorithms, simulated demo traffic.
- Node.js 20 or newer and npm.
- A MongoDB Atlas cluster and database user for persistent route history. Route calculation remains available without MongoDB; history then remains in server memory only and is lost on restart.
- Nominatim and OSRM public services for place search and road directions. Both public services are best-effort and subject to usage policies/rate limits; neither is an SLA-backed production service. Deploy your own services or select contracted providers for production volume.

## Configuration

Create `server/.env` from `server/.env.example` and set `MONGODB_URI` to the connection string copied from Atlas. Keep the file private; `.env` files are ignored by git. If the database user's password includes reserved URI characters, URL-encode the password in the URI. Never commit credentials or put them in frontend variables.

For live traffic-aware routing, obtain a TomTom developer account/API key and set `TOMTOM_API_KEY` in `server/.env`. The key is sent only from Express to TomTom in the `TomTom-Api-Key` header. The official pricing page currently lists 20,000 monthly free Routing API requests; check your TomTom account's current plan, terms, and overage pricing before deployment. No key is currently configured in this environment, so road requests use OSRM standard estimates and report live traffic as unavailable.

Official references: [TomTom Orbis Routing v3 Calculate Route](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/calculate-route), [Routing API product information](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/product-information/introduction), [TomTom pricing](https://docs.tomtom.com/pricing). The API documentation describes `traffic: "live"`, route alternatives, traffic-aware travel duration, and traffic delay fields.

`NOMINATIM_CONTACT` is optional and should be set to an application contact email for deployments making sustained public Nominatim requests. The backend identifies itself with a SmartRoute User-Agent, caches identical searches briefly, and spaces uncached requests to at least one per second.

Optionally create `client/.env` from `client/.env.example` to set `VITE_API_BASE_URL`; the default is `http://localhost:5000/api`.

In Atlas, confirm the cluster is running, the database user exists, and Network Access permits the development machine's public IP. Atlas SRV DNS must resolve from the development network before authentication or IP access can be tested.

## Start the app

Use two terminals, from the project root `D:\SmartRoute\smartroute`:

```powershell
npm --prefix .\server install
npm --prefix .\client install
npm --prefix .\server start
npm --prefix .\client run dev
```

The API listens on port 5000 by default and Vite on port 5173. Start only one backend instance. If port 5000 is occupied, inspect its owner before stopping it:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5000 | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" | Select-Object ProcessId, Name, CommandLine }
```

If it is the SmartRoute backend, use that instance or stop that confirmed process before starting another. The API logs a clear `EADDRINUSE` message and does not switch ports automatically. Ctrl+C triggers graceful shutdown.

## API

- `GET /api/health` reports server health, database readiness, history persistence, demo traffic level, and whether a TomTom key is configured (boolean only).
- `GET /api/locations` returns the six curated endpoints for demo-graph mode only.
- `GET /api/locations/search?q=Chennai%20Central` returns real Nominatim suggestions with names, full address labels, and coordinates. Search queries must be 3–160 characters.
- `POST /api/routes/calculate` in road mode accepts selected geocoder result objects as `source` and `destination`, plus `optimization`: `{ "source": { "name": "...", "displayName": "...", "lat": 13.08, "lng": 80.27 }, "destination": { "name": "...", "displayName": "...", "lat": 13.05, "lng": 80.28 }, "optimization": "time", "routingMode": "road" }`. With TomTom configured, the API returns live-traffic-aware routes and alternatives; `time` picks the lowest returned traffic-aware duration, `distance` the lowest returned distance. Without TomTom or on provider errors, it uses OSRM standard routing and clearly marks traffic as unavailable/fallback. It never applies demo traffic multipliers in road mode.
- When `TOMTOM_API_KEY` is set, road mode calls TomTom Orbis Routing API v3 with `traffic: "live"` and up to three alternatives. The backend selects by returned travel duration for `time` or returned distance for `distance`. If the key is absent or TomTom fails, it uses OSRM and marks traffic status `unavailable` or `fallback`.
- `POST /api/routes/calculate` in demo mode accepts `{ "source": "A", "destination": "E", "algorithm": "dijkstra", "optimization": "distance", "routingMode": "demo" }`. Dijkstra/A* run only on the synthetic graph.
- `POST /api/traffic/simulate` accepts `{ "level": "moderate" }` (low, moderate, or heavy) for demo-graph mode only.
- `GET /api/routes/history?limit=20` returns recent history (limit 1–100) and the `X-History-Persistence` header.
- `POST /api/routes/history` saves route names, selected endpoint coordinates where available, provider, route geometry, metrics, and timestamp. Mongo saves return `201` and `persisted: true`; memory fallback returns `202` and `persisted: false`.

## Tests and build

```powershell
npm --prefix .\server test
npm --prefix .\client run build
npm --prefix .\server audit
npm --prefix .\client audit
```

The MongoDB integration test saves a real route, disconnects/reconnects, verifies retrieval, then deletes only its own test record. It is skipped with a reason if Atlas cannot be reached. Geocoding and OSRM adapter tests use deterministic provider fixtures; run live place-pair checks separately to confirm current public-service availability.

## Routing and traffic limitations

The six endpoints in `server/data/roadNetwork.js` are curated demonstration locations, not a downloaded city road graph. They appear only in demo mode. Road mode geocodes arbitrary names via Nominatim and sends the selected coordinates to OSRM; displayed road geometry comes from OSRM. Public Nominatim and OSRM endpoints have usage policies and availability limits. Nominatim is throttled/cached server-side; OSRM is best effort. No private provider credentials are needed or exposed by the client.

Live traffic is provided only by a successful TomTom live-routing response, with a retrieval timestamp and the provider's traffic-delay estimate when returned. There is no traffic cache in this implementation. OSRM has standard estimated travel times but no verified live congestion data. Simulated low/moderate/heavy multipliers exist only in demo-graph mode and never modify road-mode route estimates. TomTom authentication, rate-limit, timeout, and service failures fall back to OSRM with explicit status rather than simulated traffic.

## Troubleshooting

- **MongoDB unavailable:** Check the `MONGODB_URI` key in `server/.env`, copy the current URI from Atlas, confirm the cluster is running, check Atlas Network Access, then confirm SRV DNS works on the current network. The app never logs the URI or password. Authentication errors indicate a database-user/password issue; DNS/SRV errors occur before credentials can be checked.
- **Reserved password characters:** URL-encode them in the URI; do not change the Atlas password just to troubleshoot.
- **Port 5000 in use:** Identify the listener with the command above. Reuse the existing SmartRoute process or stop only that verified process.
- **Offline history:** A memory-only response is temporary and will not survive backend restart. The frontend labels this clearly; only MongoDB-backed records persist.
