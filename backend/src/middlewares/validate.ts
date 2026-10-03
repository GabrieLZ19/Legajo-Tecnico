import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodRawShape } from 'zod';

export const validate = (schema: ZodObject<ZodRawShape>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Aplicar transforms/preprocess de Zod al request
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      if (parsed.query !== undefined) {
        req.query = parsed.query as Request['query'];
      }
      if (parsed.params !== undefined) {
        req.params = parsed.params as Request['params'];
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
