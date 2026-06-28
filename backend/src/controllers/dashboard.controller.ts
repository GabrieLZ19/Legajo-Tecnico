import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';

export const dashboardController = {
  async obtenerMetricas(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId } = req.params;
      const metricas = await dashboardService.obtenerMetricas(empresaId as string);
      res.json(metricas);
    } catch (error) {
      next(error);
    }
  }
};
