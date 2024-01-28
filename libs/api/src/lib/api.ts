import { initClient } from '@ts-rest/core';
import { contract } from './contract';

export const api = initClient(contract, {
  baseUrl: 'http://localhost:8080',
  baseHeaders: {},
});
