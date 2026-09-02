import type { RequestHandler } from "express";

export const asyncHandler = (
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler => {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
};
