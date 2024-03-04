import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const rooms = c.router(
  {
    announce: {
      method: 'POST',
      path: '/announce',
      responses: {
        200: c.type<void>(),
      },
      body: z.object({
        message: z.string(),
      }),
      summary: 'Announce to all rooms',
    },
    get: {
      method: 'GET',
      path: '/',
      responses: {
        200: c.type<void>(),
      },
      summary: 'Dummy endpoint to check api pathing',
    },
  },
  { pathPrefix: '/rooms' }
);
