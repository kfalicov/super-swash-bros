import { initContract } from '@ts-rest/core';
import { rooms } from './routes/rooms';

const c = initContract();

export const contract = c.router({
  rooms,
});
