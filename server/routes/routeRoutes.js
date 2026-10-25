const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');

router.get('/health', routeController.health);
router.get('/locations', routeController.getLocations);
router.get('/locations/search', routeController.searchLocations);
router.post('/routes/calculate', routeController.calculateRoute);
router.post('/traffic/simulate', routeController.simulateTraffic);
router.get('/routes/history', routeController.getRouteHistory);
router.post('/routes/history', routeController.saveRouteHistory);

module.exports = router;
