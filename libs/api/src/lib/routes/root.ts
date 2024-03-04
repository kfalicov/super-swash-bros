import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const root = c.router({
  up: {
    method: 'GET',
    path: '/',
    responses: {
      200: c.type<void>(),
      404: c.type<void>(),
      504: c.type<void>(),
    },
    summary: 'Check the up status of the api',
  },
});
