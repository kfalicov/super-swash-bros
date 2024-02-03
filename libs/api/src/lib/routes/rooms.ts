import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const rooms = c.router({
  //TODO remove this because it should not be invoked from FE
  announce: {
    method: 'POST',
    path: '/rooms/announce',
    responses: {
      200: c.type<void>(),
    },
    body: z.object({
      message: z.string(),
    }),
    summary: 'Announce to all rooms',
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
