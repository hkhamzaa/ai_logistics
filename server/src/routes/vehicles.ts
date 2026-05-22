import { Router, type IRouter, type Request, type Response } from 'express';
import { VehicleRepository } from '../models/vehicle.repository';
import { routeCache } from '../simulation/routes';

export const vehiclesRouter: IRouter = Router();

vehiclesRouter.get('/vehicles', async (_req: Request, res: Response) => {
  const vehicles = await VehicleRepository.findAll();
  // Attach decoded waypoints from in-memory route cache
  const withWaypoints = vehicles.map((v) => ({
    ...v,
    waypoints: routeCache.get(v.id)?.waypoints ?? [],
  }));
  res.json(withWaypoints);
});

vehiclesRouter.get('/vehicles/:id', async (req: Request, res: Response) => {
  const vehicle = await VehicleRepository.findById(req.params['id'] ?? '');
  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' });
    return;
  }
  res.json({ ...vehicle, waypoints: routeCache.get(vehicle.id)?.waypoints ?? [] });
});

vehiclesRouter.get('/vehicles/:id/waypoints', async (req: Request, res: Response) => {
  const vehicle = await VehicleRepository.findById(req.params['id'] ?? '');
  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found' });
    return;
  }
  const cached = routeCache.get(vehicle.id);
  res.json({ vehicleId: vehicle.id, waypoints: cached?.waypoints ?? [], distanceKm: cached?.distanceKm ?? 0 });
});
