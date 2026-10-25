const test = require('node:test');
const assert = require('node:assert/strict');
const { searchLocations } = require('../services/geocoding');

test('Nominatim search returns named, disambiguated real result coordinates', async () => {
  let requestedUrl;
  let requestedHeaders;
  const results = await searchLocations(`SmartRoute test ${Date.now()}`, async (url, options) => {
    requestedUrl = new URL(url);
    requestedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      json: async () => [{
        place_id: 901,
        name: 'Central Station',
        display_name: 'Central Station, Chennai, Tamil Nadu, India',
        lat: '13.0827',
        lon: '80.2707',
        address: { city: 'Chennai', country: 'India' },
      }],
    };
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'Central Station');
  assert.equal(results[0].displayName, 'Central Station, Chennai, Tamil Nadu, India');
  assert.equal(results[0].lat, 13.0827);
  assert.equal(results[0].lng, 80.2707);
  assert.match(requestedUrl.hostname, /nominatim\.openstreetmap\.org/);
  assert.equal(requestedUrl.searchParams.get('addressdetails'), '1');
  assert.match(requestedHeaders['User-Agent'], /SmartRoute/);
});

test('Nominatim search rejects too-short input before making a request', async () => {
  await assert.rejects(searchLocations('xy', async () => assert.fail('No request should be made')), {
    statusCode: 400,
  });
});

test('Nominatim search reports external service failure instead of fabricating results', async () => {
  await assert.rejects(searchLocations(`service failure ${Date.now()}`, async () => ({
    ok: false,
    status: 503,
  })), {
    statusCode: 503,
    message: /HTTP 503/,
  });
});

test('Nominatim search preserves a valid empty result set', async () => {
  const results = await searchLocations(`no matching place ${Date.now()}`, async () => ({
    ok: true,
    status: 200,
    json: async () => [],
  }));
  assert.deepEqual(results, []);
});