import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const rooms = c.router({
  create: {
    method: 'POST',
    path: '/rooms/new',
    responses: {
      201: c.type<string>(),
    },
    body: z.undefined(),
    summary: 'Create a room',
  },
  join: {
    method: 'GET',
    path: `/rooms/:id`,
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: c.type<string | null>(),
    },
    summary: 'join a room by id',
  },
});
