import { initContract } from '@ts-rest/core';
import { rooms } from './routes/rooms';
import { root } from './routes/root';

const c = initContract();

export const contract = c.router({
  rooms,
  root,
});
